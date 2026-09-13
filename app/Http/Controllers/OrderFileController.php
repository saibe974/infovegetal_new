<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class OrderFileController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate(['year' => 'nullable|integer|between:1900,9999', 'month' => 'nullable|integer|between:1,12']);
        $query = $request->user()->files()->whereNotNull('document_key')->where('disk', 'local');
        $years = (clone $query)->select('document_date')->distinct()->pluck('document_date')
            ->map(fn ($date) => $date->format('Y'))->unique()->sortDesc()->values();
        if (! empty($filters['year'])) {
            $query->whereYear('document_date', $filters['year']);
        }
        if (! empty($filters['month'])) {
            $query->whereMonth('document_date', $filters['month']);
        }

        return Inertia::render('settings/files', [
            'files' => $query->orderByDesc('document_date')->orderByDesc('id')->paginate(30)->withQueryString()->through(fn ($file) => [
                'id' => $file->id, 'name' => $file->file_name, 'size' => $file->file_size,
                'date' => $file->document_date->format('Y-m-d'), 'order_id' => $file->cart_id,
                'download_url' => route('order-files.download', $file->id),
                'preview_url' => $file->mime === 'application/pdf' ? route('order-files.preview', $file->id) : null,
            ]),
            'years' => $years, 'filters' => $filters,
        ]);
    }

    public function download(Request $request, int $file)
    {
        return $this->serve($request, $file, false);
    }

    public function preview(Request $request, int $file)
    {
        return $this->serve($request, $file, true);
    }

    public function cartPdf(Request $request, int $cart)
    {
        $query = $request->user()->files()->where('cart_id', $cart)->where('mime', 'application/pdf');
        $file = (clone $query)->where('document_key', 'order-pdf')->first()
            ?? $query->whereNotNull('document_key')->latest('id')->firstOrFail();

        return $this->serve($request, $file->id, true);
    }

    private function serve(Request $request, int $id, bool $inline)
    {
        $file = $request->user()->files()->whereNotNull('document_key')->findOrFail($id);
        abort_unless($file->disk === 'local'
            && str_starts_with($file->file_path, 'meta_user/'.$request->user()->id.'/commandes/')
            && ! str_contains($file->file_path, '..')
            && ! str_contains($file->file_path, '\\'), 404);
        abort_unless(Storage::disk('local')->exists($file->file_path), 404);
        abort_if($inline && $file->mime !== 'application/pdf', 404);

        return Storage::disk('local')->response($file->file_path, $file->file_name, [
            'Content-Type' => $file->mime,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }
}
