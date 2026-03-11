<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Collection;

class PdfRollDistributionService
{
    private array $packerItems = [];
    private array $packerCtr = ['x' => 100.0, 'y' => 0.0, 'z' => 0.0];
    private float $packerTotal = 0.0;
    private float $packerTol = 0.0;
    private array $packerTree = [];
    private array $packerBest = ['val' => '', 'x' => 0.0, 'y' => 0.0, 'vol' => 0.0, 'perte' => 0.0];

    public function build(Collection $items): array
    {
        $suppliersTri = $this->firstTri($items);
        $suppliers = [];
        $totalRolls = 0;
        $totalFloors = 0;
        $totalCartons = 0;
        $totalLoss = 0.0;

        foreach ($suppliersTri as $supplierId => $supplierTri) {
            $rolls = $supplierTri['mod_liv'] === 'roll' ? $this->binpack($supplierTri) : [];
            $rollCount = count($rolls);
            $floorCount = array_reduce($rolls, fn (int $sum, array $roll) => $sum + count($roll['etages']), 0);
            $cartonCount = array_reduce($rolls, fn (int $sum, array $roll) => $sum + array_reduce($roll['etages'], fn (int $carry, array $etage) => $carry + count($etage['cartons'] ?? []), 0), 0);
            $lossTotal = array_reduce($rolls, fn (float $sum, array $roll) => $sum + (float) $roll['perte'], 0.0);
            $coefTotal = array_reduce($rolls, fn (float $sum, array $roll) => $sum + (float) $roll['coef'], 0.0);

            $totalRolls += $rollCount;
            $totalFloors += $floorCount;
            $totalCartons += $cartonCount;
            $totalLoss += $lossTotal;

            $suppliers[] = [
                'supplier_id' => $supplierId,
                'name' => $supplierTri['name'] ?: 'Supplier ' . $supplierId,
                'country' => $supplierTri['country'] ?: '',
                'mod_liv' => $supplierTri['mod_liv'],
                'mini' => $supplierTri['mini'],
                'rolls' => $rolls,
                'roll_count' => $rollCount,
                'floor_count' => $floorCount,
                'carton_count' => $cartonCount,
                'coef_avg' => $rollCount > 0 ? round($coefTotal / $rollCount, 1) : 0,
                'coef_total' => round($coefTotal, 1),
                'loss_total' => round($lossTotal, 1),
                'non_roll_items' => $supplierTri['non_roll_items'],
            ];
        }

        return [
            'suppliers' => $suppliers,
            'totals' => [
                'roll_count' => $totalRolls,
                'floor_count' => $totalFloors,
                'carton_count' => $totalCartons,
                'loss_total' => round($totalLoss, 1),
            ],
        ];
    }

    private function firstTri(Collection $items): array
    {
        $suppliers = [];
        $cartonId = 0;

        foreach ($items as $item) {
            /** @var Product $product */
            $product = $item['product'];
            $supplierId = (int) floor((float) ($product->db_products_id ?? $product->dbProduct?->id ?? 0));
            if ($supplierId <= 0) {
                continue;
            }

            if (!isset($suppliers[$supplierId])) {
                $suppliers[$supplierId] = $this->buildSupplierTri($product);
            }

            $supplier = &$suppliers[$supplierId];
            $cond = max(0, (int) floor((float) ($product->cond ?? 0)));
            $floor = max(0, (int) floor((float) ($product->floor ?? 0)));
            $roll = max(0, (int) floor((float) ($product->roll ?? 0)));
            $qty = max(0, (int) ($item['quantity'] ?? 0));

            if ($supplier['mod_liv'] !== 'roll') {
                $supplier['non_roll_items'][] = [
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'quantity' => $qty,
                ];
                unset($supplier);
                continue;
            }

            if ($cond <= 0 || $floor <= 0 || $roll <= 0 || $qty <= 0) {
                unset($supplier);
                continue;
            }

            $rollUnits = $cond * $floor * $roll;
            $floorUnits = $cond * $floor;
            $nbRollFull = intdiv($qty, $rollUnits);
            $remainingAfterRoll = $qty - ($nbRollFull * $rollUnits);
            $nbFloorFull = intdiv($remainingAfterRoll, $floorUnits);
            $remainingUnits = $remainingAfterRoll - ($nbFloorFull * $floorUnits);
            $nbCartons = intdiv($remainingUnits, $cond);

            for ($i = 0; $i < $nbRollFull; $i++) {
                $supplier['rollfull'][] = $this->buildFullRoll($product->id, $floor, $roll);
            }

            for ($i = 0; $i < $nbFloorFull; $i++) {
                $supplier['etagfull'][] = $this->buildFullEtage($product->id, $floor, $roll);
            }

            $width = round((1000 / max(1, $floor))) / 10;
            $height = round((1000 / max(1, $roll))) / 10;
            for ($i = 0; $i < $nbCartons; $i++) {
                $supplier['cartons'][] = [
                    'id' => $cartonId++,
                    'product_id' => $product->id,
                    'x' => $width,
                    'y' => $height,
                ];
            }

            unset($supplier);
        }

        return $suppliers;
    }

    private function buildSupplierTri(Product $product): array
    {
        $dbProduct = $product->dbProduct;

        return [
            'mod_liv' => (string) ($dbProduct?->mod_liv ?? 'roll'),
            'mini' => max(0, (int) floor((float) ($dbProduct?->mini ?? 0))),
            'country' => (string) ($dbProduct?->country ?? ''),
            'name' => (string) ($dbProduct?->name ?? ''),
            'cartons' => [],
            'rollfull' => [],
            'etagfull' => [],
            'non_roll_items' => [],
        ];
    }

    private function buildFullRoll(int $productId, int $floor, int $roll): array
    {
        $etages = [];
        $height = round((1000 / max(1, $roll))) / 10;
        $cartonWidth = round(10000 / max(1, $floor)) / 100;

        for ($i = 0; $i < $roll; $i++) {
            $items = array_fill(0, max(1, $floor), $productId);
            $cartons = array_map(
                fn (int $currentProductId) => [
                    'product_id' => $currentProductId,
                    'x' => $cartonWidth,
                    'y' => $height,
                ],
                $items,
            );
            $etages[] = [
                'x' => 100.0,
                'y' => $height,
                'perte' => 0.0,
                'items' => $items,
                'cartons' => $cartons,
            ];
        }

        return [
            'etages' => $etages,
            'perte' => 0.0,
            'coef' => 100.0,
            'nbetages' => $roll,
        ];
    }

    private function buildFullEtage(int $productId, int $floor, int $roll): array
    {
        $items = array_fill(0, max(1, $floor), $productId);
        $cartonWidth = round(10000 / max(1, $floor)) / 100;

        return [
            'x' => 100.0,
            'y' => round((1000 / max(1, $roll))) / 10,
            'perte' => 0.0,
            'items' => $items,
            'cartons' => array_map(
                fn (int $currentProductId) => [
                    'product_id' => $currentProductId,
                    'x' => $cartonWidth,
                    'y' => round((1000 / max(1, $roll))) / 10,
                ],
                $items,
            ),
        ];
    }

    private function binpack(array $supplierTri): array
    {
        $rolls = [];
        $rollfull = $supplierTri['rollfull'];
        $etagfull = $supplierTri['etagfull'];
        $cartons = array_values($supplierTri['cartons']);

        usort($cartons, fn (array $a, array $b): int => $a['y'] === $b['y'] ? 0 : ($a['y'] > $b['y'] ? -1 : 1));

        $cartonsEgaux = [];
        foreach ($cartons as $carton) {
            $key = $carton['x'] . '-' . $carton['y'];
            if (!isset($cartonsEgaux[$key])) {
                $cartonsEgaux[$key] = [
                    'x' => (float) $carton['x'],
                    'y' => (float) $carton['y'],
                    'items' => [],
                    'cartons' => [],
                ];
            }

            $cartonsEgaux[$key]['items'][] = $carton['product_id'];
            $cartonsEgaux[$key]['cartons'][] = $carton;
        }

        $etagfullmixt = [];
        $cartonsOrphelins = [];
        $k = 0;

        foreach (array_values($cartonsEgaux) as $ce) {
            $count = count($ce['items']);
            if ($count * $ce['x'] >= 100) {
                $xtmp = 0.0;
                $etagfullmixt[$k] = ['x' => 100.0, 'y' => $ce['y'], 'perte' => 0.0, 'items' => [], 'cartons' => []];

                foreach ($ce['cartons'] as $carton) {
                    if ($xtmp + $ce['x'] > 102) {
                        $k += 1;
                        $etagfullmixt[$k] = ['x' => 100.0, 'y' => $ce['y'], 'perte' => 0.0, 'items' => [], 'cartons' => []];
                        $xtmp = 0.0;
                    }

                    if ($xtmp + $ce['x'] > 100) {
                        $etagfullmixt[$k]['perte'] = 100 - ($xtmp + $ce['x']);
                    }

                    $etagfullmixt[$k]['items'][] = $carton['product_id'];
                    $etagfullmixt[$k]['cartons'][] = [
                        'product_id' => $carton['product_id'],
                        'x' => (float) $carton['x'],
                        'y' => (float) $carton['y'],
                    ];
                    $xtmp += $ce['x'];
                }

                if (count($etagfullmixt[$k]['items']) < (100 / max(0.1, $ce['x']))) {
                    foreach ($etagfullmixt[$k]['cartons'] as $carton) {
                        $cartonsOrphelins[] = [
                            'id' => count($cartonsOrphelins),
                            'product_id' => $carton['product_id'],
                            'x' => $carton['x'],
                            'y' => $carton['y'],
                        ];
                    }

                    array_pop($etagfullmixt);
                    $k -= 1;
                }

                $k += 1;
            } else {
                foreach ($ce['cartons'] as $carton) {
                    $cartonsOrphelins[] = [
                        'id' => count($cartonsOrphelins),
                        'product_id' => $carton['product_id'],
                        'x' => (float) $carton['x'],
                        'y' => (float) $carton['y'],
                    ];
                }
            }
        }

        $binpackEtage = $this->packerInit(
            array_map(fn (array $carton) => ['x' => (float) $carton['x'], 'y' => (float) $carton['y']], $cartonsOrphelins),
            ['x' => 100.0, 'y' => 100.0, 'z' => 0.0],
            2.0,
        );

        $etagmixt = [];
        $k = 0;
        foreach ($binpackEtage as $bp) {
            if (($bp['val'] ?? '') === '') {
                continue;
            }

            $etage = [
                'x' => (float) $bp['x'],
                'y' => (float) $bp['y'],
                'perte' => round(((float) $bp['perte']) / 100, 2),
                'items' => [],
                'cartons' => [],
            ];

            foreach (explode('-', (string) $bp['val']) as $key) {
                $idx = (int) $key;
                if ($key === '' || !isset($cartonsOrphelins[$idx])) {
                    continue;
                }

                $carton = $cartonsOrphelins[$idx];
                $etage['items'][] = $carton['product_id'];
                $etage['cartons'][] = [
                    'product_id' => $carton['product_id'],
                    'x' => (float) $carton['x'],
                    'y' => (float) $carton['y'],
                ];
            }

            $etagmixt[$k++] = $etage;
        }

        $etages = array_merge($etagfull, $etagfullmixt, $etagmixt);
        usort($etages, fn (array $a, array $b): int => $a['perte'] === $b['perte'] ? 0 : ($a['perte'] > $b['perte'] ? 1 : -1));

        $etagformat = array_map(fn (array $etage) => ['x' => (float) $etage['y']], $etages);
        $binpackRoll = $this->packerInit($etagformat, ['x' => 100.0, 'y' => 0.0, 'z' => 0.0], 5.0);

        $rollmixt = [];
        $k = 0;
        foreach ($binpackRoll as $bp) {
            if (($bp['val'] ?? '') === '') {
                continue;
            }

            $roll = ['etages' => [], 'perte' => 0.0, 'coef' => 0.0, 'nbetages' => 0];
            $loss = (float) $bp['perte'];

            foreach (explode('-', (string) $bp['val']) as $key) {
                $idx = (int) $key;
                if ($key === '' || !isset($etages[$idx])) {
                    continue;
                }

                $roll['etages'][] = $etages[$idx];
                $loss += (float) ($etages[$idx]['perte'] ?? 0);
            }

            $roll['perte'] = round($loss, 1);
            $roll['coef'] = round(100 - $loss, 1);
            $roll['nbetages'] = count($roll['etages']);
            $rollmixt[$k++] = $roll;
        }

        $rolls = array_merge($rollfull, $rollmixt);

        return $rolls;
    }

    private function packerInit(array $items, array $ctr = ['x' => 100.0, 'y' => 0.0, 'z' => 0.0], float $tol = 0.0): array
    {
        $this->packerItems = array_map(fn (array $item) => [...$item, 'placed' => false], $items);
        $this->packerCtr = $ctr;
        $this->packerTol = $tol;
        $this->packerTotal = 0.0;
        $this->packerTree = [];

        foreach ($this->packerItems as $idx => $item) {
            $this->packerTree[] = $idx;
            $this->packerTotal += (float) ($item['x'] ?? 0);
        }

        return $this->packerStart();
    }

    private function packerStart(): array
    {
        $solutions = [];

        for ($key = 0; $key < count($this->packerTree); $key++) {
            $item = $this->packerItems[$key] ?? null;
            if (!$item || ($item['placed'] ?? false)) {
                continue;
            }

            $node = $this->buildNode();
            $node['key'] = $key;
            $this->packerBest = ['val' => '', 'x' => 0.0, 'y' => 0.0, 'perte' => $this->packerCtr['x'], 'vol' => 0.0];

            if (!empty($item['y'])) {
                $this->packerCtr['y'] = (float) $item['y'];
                $this->packerBest['perte'] *= $this->packerCtr['y'];
                $this->packerBest['y'] = $this->packerCtr['y'];
                $node['y'] = $this->packerCtr['y'];
            }

            $result = $this->packerTraverse($node);

            if (($this->packerBest['val'] ?? '') !== '') {
                $solutions[] = $this->packerBest;
                $ids = array_filter(explode('-', (string) $this->packerBest['val']), 'strlen');
                foreach ($ids as $id) {
                    $idx = (int) $id;
                    if (!isset($this->packerItems[$idx])) {
                        continue;
                    }

                    $this->packerItems[$idx]['placed'] = true;
                    $this->packerTotal -= (float) ($this->packerItems[$idx]['x'] ?? 0);
                }
            }

            if (!$result) {
                continue;
            }
        }

        return $solutions;
    }

    private function packerTraverse(array $node): array|false
    {
        $keyIndex = $this->packerTree[$node['key']] ?? null;

        if ($this->packerTotal < $this->packerCtr['x'] + ($this->packerTol * 100) / max(0.1, $this->packerCtr['x'])) {
            $sol = ['val' => '', 'x' => 0.0, 'y' => $this->packerCtr['y'], 'vol' => 0.0, 'perte' => 0.0];

            foreach ($this->packerItems as $idx => $item) {
                if ($item['placed'] ?? false) {
                    continue;
                }

                $sol['val'] .= $sol['val'] === '' ? (string) $idx : '-' . $idx;
                $sol['x'] += (float) ($item['x'] ?? 0);
                $loss = 0.0;
                if (!empty($item['y'])) {
                    $loss = (float) $item['x'] * ($this->packerCtr['y'] - (float) $item['y']);
                }
                $sol['perte'] += $loss;
                $sol['vol'] += (float) $item['x'] * (float) ($item['y'] ?? 1);
            }

            if ($this->packerCtr['y'] !== 0.0) {
                $sol['perte'] += ($this->packerCtr['x'] - $sol['x']) * $this->packerCtr['y'];
            } else {
                $sol['perte'] = $this->packerCtr['x'] - $sol['x'];
            }

            $sol['perte'] = round($sol['perte'], 2);
            $this->packerBest = $sol;
            return $sol;
        }

        if ($keyIndex === null || !isset($this->packerItems[$keyIndex])) {
            if ($node['x'] > $this->packerCtr['x'] + ($this->packerTol * 100) / max(0.1, $this->packerCtr['x'])) {
                return false;
            }

            if ($this->packerCtr['y'] !== 0.0) {
                $node['perte'] += ($this->packerCtr['x'] - $node['x']) * $this->packerCtr['y'];
            } else {
                $node['perte'] = $this->packerCtr['x'] - $node['x'];
            }

            $node['perte'] = round($node['perte'], 2);

            if (($this->packerCtr['y'] !== 0.0 && $node['vol'] > $this->packerBest['vol']) || ($this->packerCtr['y'] === 0.0 && $node['x'] > $this->packerBest['x'])) {
                $this->packerBest = $node;
                return $node;
            }

            return false;
        }

        if ($this->packerBrake($node)) {
            $node['key'] += 1;
            return $this->packerTraverse($node);
        }

        $item = $this->packerItems[$keyIndex];
        $predictedLoss = 0.0;

        if ($this->packerCtr['y'] !== 0.0) {
            $predictedLoss = ($this->packerCtr['x'] - $node['x']) * ($this->packerCtr['y'] - (float) ($item['y'] ?? 0));
            $predictedLoss = ($predictedLoss * 100) / max(0.1, ($this->packerCtr['x'] * $this->packerCtr['y']));
        }

        if ($node['perte'] + $predictedLoss > $this->packerBest['perte']) {
            return false;
        }

        $fg = [
            ...$this->buildNode(),
            'key' => $node['key'] + 1,
            'val' => $node['val'],
            'x' => $node['x'],
            'y' => $node['y'],
            'niv' => $node['niv'] + 1,
            'perte' => $node['perte'],
            'vol' => $node['vol'],
        ];

        $node['x'] += (float) ($item['x'] ?? 0);
        if ($this->packerCtr['y'] !== 0.0) {
            $node['perte'] += (float) ($item['x'] ?? 0) * ($this->packerCtr['y'] - (float) ($item['y'] ?? 0));
            $node['vol'] += (float) ($item['x'] ?? 0) * (float) ($item['y'] ?? 0);
        } else {
            $node['vol'] += (float) ($item['x'] ?? 0);
        }
        $node['val'] .= $node['val'] !== '' ? '-' . $keyIndex : (string) $keyIndex;

        $fd = [
            ...$this->buildNode(),
            'key' => $node['key'] + 1,
            'val' => $node['val'],
            'x' => $node['x'],
            'y' => $node['y'],
            'niv' => $node['niv'] + 1,
            'perte' => $node['perte'],
            'vol' => $node['vol'],
        ];

        $pd = $this->packerTraverse($fd);
        $pg = $this->packerTraverse($fg);

        return !$pd ? (!$pg ? $node : $pg) : $pd;
    }

    private function packerBrake(array $node): bool
    {
        $treeIndex = $this->packerTree[$node['key']] ?? null;
        $item = $treeIndex !== null ? ($this->packerItems[$treeIndex] ?? null) : null;
        if (!$item) {
            return true;
        }

        $tooHigh = $node['x'] + (float) ($item['x'] ?? 0) > $this->packerCtr['x'] + ($this->packerTol * 100) / max(0.1, $this->packerCtr['x']);
        return (bool) ($item['placed'] ?? false) || $tooHigh;
    }

    private function buildNode(): array
    {
        return [
            'val' => '',
            'key' => 0,
            'x' => 0.0,
            'y' => 0.0,
            'z' => 0.0,
            'vol' => 0.0,
            'perte' => 0.0,
            'niv' => 0,
        ];
    }
}