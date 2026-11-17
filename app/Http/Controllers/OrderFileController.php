<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Services\UserManagementAuthorizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OrderFileController extends Controller
{
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
        $order = app(UserManagementAuthorizationService::class)
            ->scopeManageableOrders($request->user(), Cart::query())->findOrFail($cart);
        $owner = $order->user;
        if (! $request->user()->hasRole('admin')
            && in_array((int) $request->user()->id, $order->workflow['participants'] ?? [], true)) {
            // Assigned parties receive the copy scoped to their product databases.
            $owner = $request->user();
        }
        $query = $owner->files()->where('cart_id', $cart)->where('mime', 'application/pdf');
        $file = (clone $query)->where('document_key', 'order-pdf')->first()
            ?? $query->whereNotNull('document_key')->latest('id')->firstOrFail();

        return $this->serve($request, $file->id, true, $owner);
    }

    private function serve(Request $request, int $id, bool $inline, ?\App\Models\User $owner = null)
    {
        $owner ??= $request->user();
        $file = $owner->files()->findOrFail($id);
        abort_unless(in_array($file->disk, ['local', 'public'], true)
            && str_starts_with($file->file_path, 'user-meta/'.$owner->id.'/')
            && ! str_contains($file->file_path, '..')
            && ! str_contains($file->file_path, '\\'), 404);
        abort_unless(Storage::disk($file->disk)->exists($file->file_path), 404);
        abort_if($inline && $file->mime !== 'application/pdf', 404);

        return Storage::disk($file->disk)->response($file->file_path, $file->file_name, [
            'Content-Type' => $file->mime,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }
}
