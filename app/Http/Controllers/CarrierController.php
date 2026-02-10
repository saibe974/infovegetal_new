<?php

namespace App\Http\Controllers;

use App\Http\Resources\CarrierResource;
use App\Models\Carrier;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CarrierController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->get('q');
        $query = Carrier::query()->withCount('zones')->orderFromRequest($request);

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                    ->orWhere('country', 'like', '%' . $search . '%');
            });
        }

        return Inertia::render('carriers/index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => CarrierResource::collection(
                $query->paginate(15)
            )),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return Inertia::render('carriers/form', [
            'carrier' => CarrierResource::make(new Carrier()),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $data = $this->validateCarrier($request);
        $zones = $this->normalizeZones($data['zones'] ?? []);
        unset($data['zones']);

        $carrier = Carrier::create($data);
        $this->syncZones($carrier, $zones);

        return redirect()->route('carriers.index')
            ->with('success', 'Transporteur cree');
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return redirect()->route('carriers.index');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Carrier $carrier)
    {
        $carrier->load('zones');

        return Inertia::render('carriers/form', [
            'carrier' => CarrierResource::make($carrier),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Carrier $carrier)
    {
        $data = $this->validateCarrier($request);
        $zones = $this->normalizeZones($data['zones'] ?? []);
        unset($data['zones']);

        $carrier->update($data);
        $this->syncZones($carrier, $zones);

        return redirect()->route('carriers.index')
            ->with('success', 'Transporteur mis a jour');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Carrier $carrier)
    {
        $carrier->zones()->delete();
        $carrier->delete();

        return redirect()->route('carriers.index')
            ->with('success', 'Transporteur supprime');
    }

    private function validateCarrier(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:255'],
            'days' => ['nullable', 'integer', 'min:0'],
            'minimum' => ['nullable', 'integer', 'min:0'],
            'taxgo' => ['nullable', 'numeric', 'min:0'],
            'zones' => ['array'],
            'zones.*.id' => ['nullable', 'integer', 'exists:carrier_zones,id'],
            'zones.*.name' => ['required', 'string', 'max:100'],
            'zones.*.tariffs' => ['nullable', 'array'],
        ]);
    }

    private function normalizeZones(array $zones): array
    {
        return collect($zones)
            ->filter(fn ($zone) => is_array($zone))
            ->map(function ($zone) {
                $tariffs = $this->normalizeTariffs($zone['tariffs'] ?? []);
                return [
                    'id' => $zone['id'] ?? null,
                    'name' => (string) ($zone['name'] ?? ''),
                    'tariffs' => $tariffs,
                ];
            })
            ->values()
            ->all();
    }

    private function normalizeTariffs(array $tariffs): array
    {
        $normalized = [];

        foreach ($tariffs as $key => $value) {
            if ($key === '' || $key === null) {
                continue;
            }

            if (is_string($key) && str_starts_with($key, 'roll:')) {
                $key = substr($key, 5);
            }

            if ($value === '') {
                continue;
            }

            if ($value === null) {
                $normalized[(string) $key] = null;
                continue;
            }

            $normalized[(string) $key] = is_numeric($value) ? (float) $value : $value;
        }

        return $normalized;
    }

    private function syncZones(Carrier $carrier, array $zones): void
    {
        $existing = $carrier->zones()->get()->keyBy('id');
        $keepIds = [];

        foreach ($zones as $zone) {
            $payload = [
                'name' => $zone['name'],
                'tariffs' => $zone['tariffs'],
            ];

            if (!empty($zone['id']) && $existing->has($zone['id'])) {
                $existing[$zone['id']]->update($payload);
                $keepIds[] = (int) $zone['id'];
                continue;
            }

            $created = $carrier->zones()->create($payload);
            $keepIds[] = (int) $created->id;
        }

        if (count($zones) === 0) {
            $carrier->zones()->delete();
            return;
        }

        $carrier->zones()->whereNotIn('id', $keepIds)->delete();
    }
}
