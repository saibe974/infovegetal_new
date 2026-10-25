<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\OrderDocument;
use App\Models\OrderIssue;
use App\Models\Product;
use App\Services\InvoiceNumberService;
use App\Services\OrderWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class OrderWorkflowController extends Controller
{
    public function show(Request $request, Cart $cart, OrderWorkflowService $service)
    {
        $actor = $request->user();
        $service->authorizeView($actor, $cart);
        $lines = collect($cart->workflow['lines'] ?? [])->map(fn ($line) => $line + [
            'can_edit' => $service->canManageLine($actor, $line),
            'accepted_quantity' => $service->acceptedQuantity($cart, $line),
        ])->values();
        $settings = DB::table('invoice_number_settings')->where('user_id', $actor->id)->first();
        $pattern = $settings?->pattern ?? InvoiceNumberService::DEFAULT_PATTERN;
        try {
            $preview = app(InvoiceNumberService::class)->format($pattern, $cart, $settings?->next_number ?? 1);
        } catch (\Illuminate\Validation\ValidationException $exception) {
            $preview = $exception->getMessage();
        }

        return Inertia::render('orders/show', [
            'order' => [
                'id' => $cart->id, 'number' => str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT),
                'status' => $cart->status, 'status_label' => OrderWorkflowService::LABELS[$cart->status] ?? $cart->status,
                'revision' => $cart->revision, 'client' => $cart->user->only(['id', 'name', 'ref']),
                'comment' => $cart->comment, 'lines' => $lines,
                'comments' => $cart->comments()->with('user:id,name')->oldest()->get(),
                'issues' => $cart->issues()->with(['user:id,name', 'reviewer:id,name'])->oldest()->get(),
                'documents' => $cart->documents()->get(['id', 'issuer_id', 'kind', 'number', 'issued_at']),
            ],
            'can_manage' => $service->canManage($actor, $cart),
            'can_invoice' => $lines->contains(fn ($line) => (int) $line['billing_user_id'] === (int) $actor->id),
            'can_report' => (int) $cart->user_id === (int) $actor->id || $service->canManage($actor, $cart),
            'numbering' => ['pattern' => $pattern, 'preview' => $preview],
        ]);
    }

    public function update(Request $request, Cart $cart, OrderWorkflowService $service)
    {
        $data = $request->validate([
            'revision' => 'required|integer|min:0', 'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'required|integer|min:1|distinct',
            'lines.*.quantity' => 'required|integer|min:0|max:1000000',
        ]);
        $service->mutate($cart, $request->user(), $data['revision'], fn ($locked) => $service->updateLines($locked, $request->user(), $data['lines']));

        return back()->with('success', 'Modifications enregistrées.');
    }

    public function action(Request $request, Cart $cart, OrderWorkflowService $service)
    {
        $data = $request->validate(['revision' => 'required|integer|min:0', 'action' => 'required|in:ship,deliver,invoice,credit,close']);
        $actor = $request->user();
        $service->mutate($cart, $actor, $data['revision'], function ($locked) use ($service, $actor, $data) {
            switch ($data['action']) {
                case 'ship': $service->ship($locked, $actor);
                    break;
                case 'deliver':
                    abort_unless($locked->status === 'delivering' && $service->canManage($actor, $locked), 403);
                    $workflow = $locked->workflow;
                    $workflow['delivered_at'] = now()->toIso8601String();
                    $locked->workflow = $workflow;
                    $locked->status = 'delivered';
                    break;
                case 'invoice': $service->invoice($locked, $actor);
                    break;
                case 'credit': $service->credit($locked, $actor);
                    break;
                case 'close': $service->close($locked, $actor);
                    break;
            }
        });

        return back()->with('success', 'Commande mise à jour.');
    }

    public function comment(Request $request, Cart $cart, OrderWorkflowService $service)
    {
        $data = $request->validate(['revision' => 'required|integer|min:0', 'body' => 'required|string|max:2000', 'product_id' => 'nullable|integer|min:1']);
        $service->mutate($cart, $request->user(), $data['revision'], function ($locked) use ($request, $data, $service) {
            abort_unless((int) $locked->user_id === (int) $request->user()->id || $service->canManage($request->user(), $locked), 403);
            if (! empty($data['product_id'])) {
                abort_unless(collect($locked->workflow['lines'] ?? [])->contains('product_id', (int) $data['product_id']), 422);
            }
            $role = (int) $locked->user_id === (int) $request->user()->id ? 'client'
                : (collect($locked->workflow['lines'])->contains('billing_user_id', (int) $request->user()->id) ? 'facturant' : 'commercial');
            $locked->comments()->create([
                'user_id' => $request->user()->id, 'author_role' => $role,
                'body' => trim($data['body']), 'product_id' => $data['product_id'] ?? null,
            ]);
        });

        return back();
    }

    public function report(Request $request, Cart $cart, OrderWorkflowService $service)
    {
        $data = $request->validate([
            'revision' => 'required|integer|min:0', 'product_id' => 'required|integer|min:1',
            'kind' => 'required|in:missing,damaged', 'quantity' => 'required|integer|min:1|max:1000000',
            'comment' => 'required|string|max:2000',
        ]);
        $revision = $data['revision'];
        unset($data['revision']);
        $service->mutate($cart, $request->user(), $revision, fn ($locked) => $service->report($locked, $request->user(), $data));

        return back();
    }

    public function review(Request $request, Cart $cart, OrderIssue $issue, OrderWorkflowService $service)
    {
        $data = $request->validate([
            'revision' => 'required|integer|min:0', 'status' => 'required|in:approved,rejected', 'resolution' => 'required|string|max:2000',
        ]);
        $revision = $data['revision'];
        unset($data['revision']);
        $service->mutate($cart, $request->user(), $revision, fn ($locked) => $service->review($locked, $request->user(), $issue->fresh(), $data));

        return back();
    }

    public function numbering(Request $request, Cart $cart, OrderWorkflowService $service, InvoiceNumberService $numbers)
    {
        $service->authorizeView($request->user(), $cart);
        abort_unless(collect($cart->workflow['lines'] ?? [])->contains('billing_user_id', (int) $request->user()->id), 403);
        $data = $request->validate(['pattern' => 'required|string|max:150']);
        $numbers->validatePattern($data['pattern']);
        DB::transaction(function () use ($request, $data) {
            DB::table('invoice_number_settings')->insertOrIgnore([
                'user_id' => $request->user()->id, 'pattern' => $data['pattern'], 'next_number' => 1, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('invoice_number_settings')->where('user_id', $request->user()->id)->lockForUpdate()->first();
            DB::table('invoice_number_settings')->where('user_id', $request->user()->id)->update(['pattern' => $data['pattern'], 'updated_at' => now()]);
        });

        return back()->with('success', 'Format de numérotation enregistré pour vos prochaines factures.');
    }

    public function products(Request $request, Cart $cart, OrderWorkflowService $service)
    {
        $service->authorizeView($request->user(), $cart);
        abort_unless($cart->status === 'processing' && $service->canManage($request->user(), $cart), 403);
        $data = $request->validate(['q' => 'required|string|min:2|max:100']);
        $dbIds = collect($cart->workflow['lines'])->filter(fn ($line) => $service->canManageLine($request->user(), $line))->pluck('db_id')->unique();

        return Product::orderableAt()->whereIn('db_products_id', $dbIds)
            ->where(fn ($q) => $q->where('name', 'like', '%'.$data['q'].'%')->orWhere('ref', 'like', '%'.$data['q'].'%'))
            ->limit(20)->get(['id', 'name', 'ref']);
    }

    public function document(Request $request, Cart $cart, OrderDocument $document, OrderWorkflowService $service)
    {
        $service->authorizeView($request->user(), $cart);
        abort_unless((int) $document->cart_id === (int) $cart->id, 404);
        $pdf = app('tcpdf');
        $pdf->reset();
        try {
            $pdf->setPrintHeader(false);
            $pdf->SetFont('dejavusans', '', 9);
            $pdf->AddPage();
            $pdf->writeHTML(view('pdf.order-document', ['document' => $document, 'snapshot' => $document->snapshot])->render());
            $binary = $pdf->Output('', 'S');
        } finally {
            $pdf->reset();
        }

        return response($binary, 200, [
            'Content-Type' => 'application/pdf', 'Cache-Control' => 'private, no-store',
            'Content-Disposition' => 'attachment; filename="'.$document->kind.'-'.$document->id.'.pdf"',
        ]);
    }
}
