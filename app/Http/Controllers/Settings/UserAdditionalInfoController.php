<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserMeta;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserAdditionalInfoController extends Controller
{
    public function edit(Request $request, ?User $user = null): Response
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        return Inertia::render('settings/additional-info', [
            'editingUser' => $target->loadMissing(['roles', 'permissions']),
            'userMeta' => $target->usersMeta()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(['id', 'user_id', 'key', 'value', 'type', 'sort_order', 'created_at', 'updated_at']),
        ]);
    }

    public function update(Request $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        $validated = $request->validate([
            'alias' => ['nullable', 'string', 'max:255', Rule::unique('users', 'alias')->ignore($target->id)],
            'ref' => ['nullable', 'string', 'max:50'],
            'tel' => ['nullable', 'string', 'max:25'],
            'address_road' => ['nullable', 'string', 'max:255'],
            'address_zip' => ['nullable', 'string', 'max:32'],
            'address_town' => ['nullable', 'string', 'max:120'],
            'active' => ['nullable', 'boolean'],
            'mailing' => ['nullable', 'boolean'],
        ]);

        $target->alias = $validated['alias'] ?? null;
        $target->ref = $validated['ref'] ?? null;
        $target->tel = $validated['tel'] ?? null;
        $target->address_road = $validated['address_road'] ?? null;
        $target->address_zip = $validated['address_zip'] ?? null;
        $target->address_town = $validated['address_town'] ?? null;
        $target->active = array_key_exists('active', $validated) ? (bool) $validated['active'] : $target->active;
        $target->mailing = array_key_exists('mailing', $validated) ? (bool) $validated['mailing'] : $target->mailing;
        $target->save();

        return back()->with('success', 'Informations complementaires mises a jour');
    }

    public function storeMeta(Request $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        $validated = $request->validate([
            'key' => ['required', 'string', 'max:255'],
            'value' => ['nullable', 'string'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $target->usersMeta()->create([
            'key' => $validated['key'],
            'value' => $validated['value'] ?? null,
            'type' => $validated['type'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return back()->with('success', 'Champ complementaire ajoute');
    }

    public function updateMeta(Request $request, UserMeta $meta, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        if ((int) $meta->user_id !== (int) $target->id) {
            abort(404);
        }

        $validated = $request->validate([
            'key' => ['required', 'string', 'max:255'],
            'value' => ['nullable', 'string'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $meta->update([
            'key' => $validated['key'],
            'value' => $validated['value'] ?? null,
            'type' => $validated['type'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return back()->with('success', 'Champ complementaire mis a jour');
    }

    public function destroyMeta(Request $request, UserMeta $meta, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        if ((int) $meta->user_id !== (int) $target->id) {
            abort(404);
        }

        $meta->delete();

        return back()->with('success', 'Champ complementaire supprime');
    }

    private function authorizeTarget(Request $request, User $target): void
    {
        $actor = $request->user();

        if (!$actor) {
            abort(403, 'Unauthorized');
        }

        if ((int) $actor->id === (int) $target->id) {
            return;
        }

        if ($actor->hasRole('admin')) {
            return;
        }

        // Parent users can manage descendants.
        if (method_exists($actor, 'isAncestorOf') && $actor->isAncestorOf($target)) {
            return;
        }

        abort(403, 'Unauthorized');
    }
}
