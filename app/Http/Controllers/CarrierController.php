<?php

namespace App\Http\Controllers;

use App\Http\Resources\CarrierResource;
use App\Models\Carrier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
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
        try {
            $data = $this->validateCarrier($request);
            $zones = $this->normalizeZones($data['zones'] ?? []);
            unset($data['zones']);

            $carrier = Carrier::create($data);
            $this->syncZones($carrier, $zones);

            return back()
                ->with('success', 'Transporteur cree');
        } catch (ValidationException $exception) {
            return back()
                ->withErrors($exception->errors())
                ->withInput()
                ->with('error', 'Merci de corriger les erreurs du formulaire.');
        }
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
        try {
            $data = $this->validateCarrier($request);
            $zones = $this->normalizeZones($data['zones'] ?? []);
            unset($data['zones']);

            $carrier->update($data);
            $this->syncZones($carrier, $zones);

            return back()
                ->with('success', 'Transporteur mis a jour');
        } catch (ValidationException $exception) {
            return back()
                ->withErrors($exception->errors())
                ->withInput()
                ->with('error', 'Merci de corriger les erreurs du formulaire.');
        }
    }

    public function importZones(Request $request, Carrier $carrier)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ]);

        $handle = fopen($validated['file']->getRealPath(), 'rb');

        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => 'Impossible de lire le fichier CSV.',
            ]);
        }

        try {
            $headerLine = fgets($handle);
            if ($headerLine === false) {
                throw ValidationException::withMessages([
                    'file' => 'Le fichier CSV est vide.',
                ]);
            }

            $delimiter = $this->detectDelimiter($headerLine);
            rewind($handle);

            $header = fgetcsv($handle, 0, $delimiter);
            if ($header === false) {
                throw ValidationException::withMessages([
                    'file' => 'Le fichier CSV est invalide.',
                ]);
            }

            $header = array_map(static fn ($value) => trim((string) $value), $header);
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]) ?? $header[0];

            $zoneIndex = $this->findHeaderIndex($header, ['zone', 'zones']);
            $miniIndex = $this->findHeaderIndex($header, ['mini', 'minimum']);

            if ($zoneIndex === null || $miniIndex === null) {
                throw ValidationException::withMessages([
                    'file' => 'Le CSV doit contenir les colonnes "zone" et "mini".',
                ]);
            }

            $rollColumns = [];
            foreach ($header as $index => $name) {
                if ($index === $zoneIndex || $index === $miniIndex) {
                    continue;
                }

                $roll = trim((string) $name);
                if ($roll === '') {
                    continue;
                }

                $rollColumns[$index] = $roll;
            }

            $zones = [];
            $lineNumber = 1;

            while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
                $lineNumber++;

                if ($this->rowIsEmpty($row)) {
                    continue;
                }

                $zoneName = trim((string) ($row[$zoneIndex] ?? ''));
                if ($zoneName === '') {
                    throw ValidationException::withMessages([
                        'file' => 'La ligne ' . $lineNumber . ' ne contient pas de zone.',
                    ]);
                }

                $tariffs = [];
                $mini = trim((string) ($row[$miniIndex] ?? ''));
                if ($mini !== '') {
                    $tariffs['mini'] = $this->normalizeDecimal($mini);
                }

                foreach ($rollColumns as $index => $roll) {
                    $value = trim((string) ($row[$index] ?? ''));
                    if ($value === '') {
                        continue;
                    }

                    $tariffs['roll:' . $roll] = $this->normalizeDecimal($value);
                }

                $zones[$zoneName] = [
                    'name' => $zoneName,
                    'tariffs' => $tariffs,
                ];
            }

            if ($zones === []) {
                throw ValidationException::withMessages([
                    'file' => 'Aucune zone exploitable n\'a été trouvée dans ce CSV.',
                ]);
            }

            DB::transaction(function () use ($carrier, $zones): void {
                $carrier->zones()->delete();

                foreach (array_values($zones) as $zone) {
                    $carrier->zones()->create($zone);
                }
            });

            $carrier->load('zones');

            return response()->json([
                'message' => 'Zones importées.',
                'carrier' => CarrierResource::make($carrier),
            ]);
        } finally {
            fclose($handle);
        }
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
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'country' => ['nullable', 'string', 'max:255'],
            'days' => ['nullable', 'array'],
            'days.*' => ['string', 'in:1,2,3,4,5,6,7'],
            'minimum' => ['nullable', 'integer', 'min:0'],
            'taxgo' => ['nullable', 'numeric', 'min:0'],
            'zones' => ['nullable', 'array'],
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

    private function detectDelimiter(string $line): string
    {
        $delimiters = [',', ';', "\t", '|'];
        $bestDelimiter = ',';
        $bestCount = -1;

        foreach ($delimiters as $delimiter) {
            $count = substr_count($line, $delimiter);
            if ($count > $bestCount) {
                $bestCount = $count;
                $bestDelimiter = $delimiter;
            }
        }

        return $bestDelimiter;
    }

    private function findHeaderIndex(array $header, array $candidates): ?int
    {
        foreach ($header as $index => $value) {
            $normalized = strtolower(trim($value));
            if (in_array($normalized, $candidates, true)) {
                return $index;
            }
        }

        return null;
    }

    private function rowIsEmpty(array $row): bool
    {
        foreach ($row as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function normalizeDecimal(string $value): string
    {
        return str_replace(',', '.', trim($value));
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
