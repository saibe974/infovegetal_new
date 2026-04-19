<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserMeta;
use App\Models\UserOption;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

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
            'metaKeyOptions' => $this->metaKeyOptions(),
            'metaKeyConfig' => $this->metaKeyConfig(),
        ]);
    }

    public function update(Request $request, ?User $user = null): RedirectResponse
    {
        $target = $user ?? $request->user();

        $this->authorizeTarget($request, $target);

        $validated = $request->validate([
            'alias' => ['nullable', 'string', 'max:255', Rule::unique('users', 'alias')->ignore($target->id)],
            'ref' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:25'],
            'address_road' => ['nullable', 'string', 'max:255'],
            'address_zip' => ['nullable', 'string', 'max:32'],
            'address_town' => ['nullable', 'string', 'max:120'],
            'active' => ['nullable', 'boolean'],
            'mailing' => ['nullable', 'boolean'],
        ]);

        $target->alias = $validated['alias'] ?? null;
        $target->ref = $validated['ref'] ?? null;
        $target->phone = $validated['phone'] ?? null;
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
            'custom_key' => ['nullable', 'string', 'max:255', 'required_if:key,custom'],
            'value' => ['nullable', 'string'],
            'value_json' => ['nullable', 'array'],
            'value_file' => ['nullable', 'file', 'image', 'max:5120'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        [$metaKey, $metaType, $metaValue] = $this->resolveMetaPayload($request, $target, $validated);

        $target->usersMeta()->create([
            'key' => $metaKey,
            'value' => $metaValue,
            'type' => $metaType,
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
            'custom_key' => ['nullable', 'string', 'max:255', 'required_if:key,custom'],
            'value' => ['nullable', 'string'],
            'value_json' => ['nullable', 'array'],
            'value_file' => ['nullable', 'file', 'image', 'max:5120'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        [$metaKey, $metaType, $metaValue] = $this->resolveMetaPayload($request, $target, $validated, $meta);

        $meta->update([
            'key' => $metaKey,
            'value' => $metaValue,
            'type' => $metaType,
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

        $existingMediaId = $this->extractMediaId($meta->value);
        if ($existingMediaId) {
            Media::query()->whereKey($existingMediaId)->delete();
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

        $this->authorize('update', $target);
    }

    private function metaKeyOptions(): array
    {
        return UserOption::query()
            ->where('key', 'users_meta.allowed_key')
            ->where('active', true)
            ->orderBy('sort_order')
            ->get(['value', 'label'])
            ->map(fn (UserOption $row) => [
                'value' => (string) $row->value,
                'label' => (string) ($row->label ?: $row->value),
            ])
            ->values()
            ->all();
    }

    private function metaKeyConfig(): array
    {
        $kinds = UserOption::query()
            ->where('key', 'users_meta.input_kind')
            ->where('active', true)
            ->get(['value', 'label', 'type'])
            ->keyBy('value');

        $fields = UserOption::query()
            ->where('key', 'users_meta.input_fields')
            ->where('active', true)
            ->get(['value', 'label'])
            ->keyBy('value');

        $config = [];
        foreach ($kinds as $value => $row) {
            $fieldRow = $fields->get($value);
            $config[$value] = [
                'input' => (string) ($row->label ?: $row->type ?: 'input'),
                'fields' => $fieldRow && $fieldRow->label
                    ? array_values(array_filter(array_map('trim', explode(',', (string) $fieldRow->label))))
                    : [],
            ];
        }

        return $config;
    }

    private function resolveMetaPayload(Request $request, User $target, array $validated, ?UserMeta $existingMeta = null): array
    {
        $key = (string) ($validated['key'] ?? '');
        if ($key === 'custom') {
            $key = (string) ($validated['custom_key'] ?? '');
        }

        if ($key === '') {
            abort(422, 'Invalid key');
        }

        $config = $this->metaKeyConfig();
        $inputKind = $config[$key]['input'] ?? null;

        $value = $validated['value'] ?? null;

        if ($inputKind === 'json') {
            $value = !empty($validated['value_json'])
                ? json_encode($validated['value_json'])
                : null;
        } elseif (($inputKind === 'file/image' || $key === 'logo') && $request->hasFile('value_file')) {
            $collection = $key === 'logo' ? 'user_logos' : 'user_meta_files';

            $previousMediaId = $existingMeta ? $this->extractMediaId($existingMeta->value) : null;
            if ($previousMediaId) {
                Media::query()->whereKey($previousMediaId)->delete();
            }

            $media = $target
                ->addMediaFromRequest('value_file')
                ->toMediaCollection($collection);

            $value = json_encode([
                'media_id' => $media->id,
                'collection' => $collection,
                'url' => $media->getUrl(),
                'thumb_url' => $media->getUrl('thumb'),
                'medium_url' => $media->getUrl('medium'),
                'file_name' => $media->file_name,
            ]);
        }

        $type = $validated['type'] ?? $inputKind;

        return [$key, $type, $value];
    }

    private function extractMediaId(?string $value): ?int
    {
        if (!$value) {
            return null;
        }

        $decoded = json_decode($value, true);
        if (is_array($decoded) && isset($decoded['media_id'])) {
            return (int) $decoded['media_id'];
        }

        return null;
    }
}
