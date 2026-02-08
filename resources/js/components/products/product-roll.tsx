import React, { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { type CartItem } from '@/components/cart/cart.context';
import { type Product } from '@/types';
import { BE, DE, ES, FR, GB, IT, NL } from 'country-flag-icons/react/3x2';

type BinpackItem = {
    x: number;
    y?: number;
    placed?: boolean;
};

type BinpackCtr = {
    x: number;
    y: number;
    z: number;
};

type BinpackNode = {
    val: string;
    key: number;
    x: number;
    y: number;
    z: number;
    vol: number;
    perte: number;
    niv: number;
};

type BinpackSolution = {
    val: string;
    x: number;
    y: number;
    vol: number;
    perte: number;
};

type Carton = {
    id: number;
    productId: number;
    x: number;
    y: number;
};

type Etage = {
    x: number;
    y: number;
    perte: number;
    items: number[];
};

type Roll = {
    etages: Etage[];
    perte: number;
    coef: number;
    nbetages: number;
};

type SupplierTri = {
    mod_liv: string;
    mini: number;
    country: string;
    name: string;
    cartons: Carton[];
    rollfull: Roll[];
    etagfull: Etage[];
    producers: Record<number, SupplierTri>;
    nonRollItems: CartItem[];
};

type ProducerDistribution = {
    producerId: number;
    rolls: Roll[];
    rollCount: number;
    floorCount: number;
    cartonCount: number;
    lossTotal: number;
};

export type SupplierDistribution = {
    supplierId: number;
    name: string;
    country: string;
    mod_liv: string;
    mini: number;
    rolls: Roll[];
    rollCount: number;
    floorCount: number;
    cartonCount: number;
    coefAvg: number;
    coefTotal: number;
    lossTotal: number;
    producers: Record<number, ProducerDistribution>;
    nonRollItems: CartItem[];
};

export type RollDistribution = {
    suppliers: Record<number, SupplierDistribution>;
    totals: {
        rollCount: number;
        floorCount: number;
        cartonCount: number;
        lossTotal: number;
    };
};

type ProductRollProps = {
    items: CartItem[];
    className?: string;
    width?: number;
    height?: number;
    onDistributionChange?: (distribution: RollDistribution) => void;
    getSupplierPrice?: (supplier: SupplierDistribution) => number | null;
};

const toNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const buildNode = (): BinpackNode => ({
    val: '',
    key: 0,
    x: 0,
    y: 0,
    z: 0,
    vol: 0,
    perte: 0,
    niv: 0,
});

class BinPacker {
    private items: BinpackItem[] = [];
    private ctr: BinpackCtr = { x: 100, y: 0, z: 0 };
    private total = 0;
    private tol = 0;
    private arbre: number[] = [];
    private sol: BinpackSolution = { val: '', x: 0, y: 0, vol: 0, perte: 0 };

    init(params: { items: BinpackItem[]; ctr?: BinpackCtr; tol?: number }): BinpackSolution[] {
        this.items = params.items.map(item => ({ ...item, placed: false }));
        this.ctr = params.ctr ?? { x: 100, y: 0, z: 0 };
        this.tol = params.tol ?? 0;
        this.total = 0;
        this.arbre = [];

        this.items.forEach((item, idx) => {
            this.arbre.push(idx);
            this.total += item.x;
        });

        return this.amorce();
    }

    private amorce(): BinpackSolution[] {
        const solution: BinpackSolution[] = [];
        for (let key = 0; key < this.arbre.length; key += 1) {
            const item = this.items[key];
            if (!item || item.placed) continue;

            const node = buildNode();
            node.key = key;

            this.sol = { val: '', x: 0, y: 0, perte: this.ctr.x, vol: 0 };

            if (item.y) {
                this.ctr.y = item.y;
                this.sol.perte *= item.y;
                this.sol.y = item.y;
                node.y = item.y;
            }

            const result = this.parcours(node);

            if (this.sol.val !== '') {
                solution.push(this.sol);
                const ids = this.sol.val.split('-').filter(Boolean);
                ids.forEach((id) => {
                    const idx = Number.parseInt(id, 10);
                    if (!Number.isNaN(idx) && this.items[idx]) {
                        this.items[idx].placed = true;
                        this.total -= this.items[idx].x;
                    }
                });
            }

            if (!result) continue;
        }

        return solution;
    }

    private parcours(node: BinpackNode): BinpackSolution | false {
        const keyIndex = this.arbre[node.key];

        if (this.total < this.ctr.x + (this.tol * 100) / this.ctr.x) {
            const sol: BinpackSolution = {
                val: '',
                x: 0,
                y: this.ctr.y,
                vol: 0,
                perte: 0,
            };

            this.items.forEach((item, idx) => {
                if (item.placed) return;
                sol.val += sol.val === '' ? `${idx}` : `-${idx}`;
                sol.x += item.x;
                let loss = 0;
                if (item.y) {
                    loss = item.x * (this.ctr.y - item.y);
                }
                sol.perte += loss;
                sol.vol += item.x * (item.y ?? 1);
            });

            if (this.ctr.y !== 0) {
                const loss = (this.ctr.x - sol.x) * this.ctr.y;
                sol.perte += loss;
            } else {
                sol.perte = this.ctr.x - sol.x;
            }

            sol.perte = Math.round(sol.perte * 100) / 100;
            this.sol = sol;
            return sol;
        }

        if (typeof this.items[keyIndex] === 'undefined') {
            if (node.x > this.ctr.x + (this.tol * 100) / this.ctr.x) return false;

            if (this.ctr.y !== 0) {
                const loss = (this.ctr.x - node.x) * this.ctr.y;
                node.perte += loss;
            } else {
                node.perte = this.ctr.x - node.x;
            }

            node.perte = Math.round(node.perte * 100) / 100;

            if ((this.ctr.y !== 0 && node.vol > this.sol.vol) || (this.ctr.y === 0 && node.x > this.sol.x)) {
                this.sol = node;
                return node;
            }
            return false;
        }

        if (this.brake(node)) {
            node.key += 1;
            return this.parcours(node);
        }

        const item = this.items[keyIndex];
        let predictedLoss = 0;

        if (this.ctr.y !== 0) {
            predictedLoss = (this.ctr.x - node.x) * (this.ctr.y - (item.y ?? 0));
            predictedLoss = (predictedLoss * 100) / (this.ctr.x * this.ctr.y);
        }

        if (node.perte + predictedLoss > this.sol.perte) return false;

        const fg: BinpackNode = {
            ...buildNode(),
            key: node.key + 1,
            val: node.val,
            x: node.x,
            y: node.y,
            niv: node.niv + 1,
            perte: node.perte,
            vol: node.vol,
        };

        node.x += item.x;
        if (this.ctr.y !== 0) {
            const loss = item.x * (this.ctr.y - (item.y ?? 0));
            const vol = item.x * (item.y ?? 0);
            node.perte += loss;
            node.vol += vol;
        } else {
            node.vol += item.x;
        }
        node.val += node.val !== '' ? `-${keyIndex}` : `${keyIndex}`;

        const fd: BinpackNode = {
            ...buildNode(),
            key: node.key + 1,
            val: node.val,
            x: node.x,
            y: node.y,
            niv: node.niv + 1,
            perte: node.perte,
            vol: node.vol,
        };

        const pd = this.parcours(fd);
        const pg = this.parcours(fg);

        return !pd ? (!pg ? node : pg) : pd;
    }

    private brake(node: BinpackNode): boolean {
        const item = this.items[this.arbre[node.key]];
        if (!item) return true;
        const tooHigh = node.x + item.x > this.ctr.x + (this.tol * 100) / this.ctr.x;
        return !!item.placed || tooHigh;
    }
}

const buildFullRoll = (productId: number, floor: number, roll: number): Roll => {
    const etages: Etage[] = [];
    const height = Math.round(1000 / roll) / 10;
    for (let i = 0; i < roll; i += 1) {
        const items: number[] = [];
        for (let k = 0; k < floor; k += 1) {
            items.push(productId);
        }
        etages.push({ x: 100, y: height, perte: 0, items });
    }
    return { coef: 100, nbetages: roll, perte: 0, etages };
};

const buildFullEtage = (productId: number, floor: number, roll: number): Etage => {
    const items: number[] = [];
    for (let k = 0; k < floor; k += 1) {
        items.push(productId);
    }
    return {
        x: 100,
        y: Math.round(1000 / roll) / 10,
        perte: 0,
        items,
    };
};

const buildSupplierTri = (product: Product): SupplierTri => {
    const dbProduct = product.dbProduct ?? null;
    return {
        mod_liv: (dbProduct?.mod_liv ?? 'roll').toString(),
        mini: Math.max(0, Math.floor(toNumber(dbProduct?.mini))),
        country: (dbProduct?.country ?? '').toString(),
        name: (dbProduct?.name ?? '').toString(),
        cartons: [],
        rollfull: [],
        etagfull: [],
        producers: {},
        nonRollItems: [],
    };
};

const firstTri = (items: CartItem[]): Record<number, SupplierTri> => {
    const suppliers: Record<number, SupplierTri> = {};
    let cartonId = 0;

    items.forEach((cartItem) => {
        const product = cartItem.product;
        const supplierId = Math.floor(toNumber(product.db_products_id ?? product.dbProduct?.id));
        if (!supplierId) return;

        if (!suppliers[supplierId]) {
            suppliers[supplierId] = buildSupplierTri(product);
        }

        const supplier = suppliers[supplierId];
        const producerId = Math.floor(toNumber(product.producer_id));

        if (producerId && !supplier.producers[producerId]) {
            supplier.producers[producerId] = buildSupplierTri(product);
        }

        const group = producerId ? supplier.producers[producerId] : null;

        const cond = Math.floor(toNumber(product.cond));
        const floor = Math.floor(toNumber(product.floor));
        const roll = Math.floor(toNumber(product.roll));
        const qty = Math.floor(toNumber(cartItem.quantity));

        if (supplier.mod_liv !== 'roll') {
            supplier.nonRollItems.push(cartItem);
            if (group) group.nonRollItems.push(cartItem);
            return;
        }

        if (cond <= 0 || floor <= 0 || roll <= 0 || qty <= 0) return;

        const rollUnits = cond * floor * roll;
        const floorUnits = cond * floor;
        const nbRollFull = Math.floor(qty / rollUnits);
        const remainingAfterRoll = qty - nbRollFull * rollUnits;
        const nbFloorFull = Math.floor(remainingAfterRoll / floorUnits);
        const remainingUnits = remainingAfterRoll - nbFloorFull * floorUnits;
        const nbCartons = Math.floor(remainingUnits / cond);

        for (let i = 0; i < nbRollFull; i += 1) {
            const rollFull = buildFullRoll(product.id, floor, roll);
            supplier.rollfull.push(rollFull);
            if (group) group.rollfull.push(buildFullRoll(product.id, floor, roll));
        }

        for (let i = 0; i < nbFloorFull; i += 1) {
            const etage = buildFullEtage(product.id, floor, roll);
            supplier.etagfull.push(etage);
            if (group) group.etagfull.push(buildFullEtage(product.id, floor, roll));
        }

        for (let i = 0; i < nbCartons; i += 1) {
            const carton: Carton = {
                id: cartonId,
                productId: product.id,
                x: Math.round(1000 / floor) / 10,
                y: Math.round(1000 / roll) / 10,
            };
            cartonId += 1;
            supplier.cartons.push(carton);
            if (group) group.cartons.push({ ...carton });
        }
    });

    return suppliers;
};

const binpacking = (cparse: SupplierTri): Roll[] => {
    const rolls: Roll[] = [];
    const rollfull = cparse.rollfull;
    const etagfull = cparse.etagfull;
    const cartons = [...cparse.cartons];

    const toleranceEtage = 2;
    const toleranceRoll = 5;

    const myBinPacking = new BinPacker();

    cartons.sort((a, b) => (a.y === b.y ? 0 : a.y > b.y ? -1 : 1));

    const cartonsEgaux: Record<string, { x: number; y: number; items: number[] }> = {};

    cartons.forEach((c) => {
        const key = `${c.x}-${c.y}`;
        if (!cartonsEgaux[key]) {
            cartonsEgaux[key] = { x: c.x, y: c.y, items: [] };
        }
        cartonsEgaux[key].items.push(c.productId);
    });

    const etagfullmixt: Etage[] = [];
    const cartonsOrphelins: Carton[] = [];
    let k = 0;

    Object.values(cartonsEgaux).forEach((ce) => {
        const count = ce.items.length;
        if (count * ce.x >= 100) {
            let xtmp = 0;
            etagfullmixt[k] = { x: 100, y: ce.y, perte: 0, items: [] };

            ce.items.forEach((productId) => {
                if (xtmp + ce.x > 100 + toleranceEtage) {
                    k += 1;
                    etagfullmixt[k] = { x: 100, y: ce.y, perte: 0, items: [] };
                    xtmp = 0;
                }
                if (xtmp + ce.x > 100) {
                    etagfullmixt[k].perte = 100 - (xtmp + ce.x);
                }
                etagfullmixt[k].items.push(productId);
                xtmp += ce.x;
            });

            if (etagfullmixt[k].items.length < 100 / ce.x) {
                etagfullmixt[k].items.forEach((productId) => {
                    cartonsOrphelins.push({
                        id: cartonsOrphelins.length,
                        productId,
                        x: ce.x,
                        y: ce.y,
                    });
                });
                etagfullmixt.pop();
                k -= 1;
            }

            k += 1;
        } else {
            ce.items.forEach((productId) => {
                cartonsOrphelins.push({
                    id: cartonsOrphelins.length,
                    productId,
                    x: ce.x,
                    y: ce.y,
                });
            });
        }
    });

    const binpackEtage = myBinPacking.init({
        items: cartonsOrphelins.map((c) => ({ x: c.x, y: c.y })),
        ctr: { x: 100, y: 100, z: 0 },
        tol: toleranceEtage,
    });

    const etagmixt: Etage[] = [];
    k = 0;
    binpackEtage.forEach((bp) => {
        if (!bp.val) return;
        const etage: Etage = {
            x: bp.x,
            y: bp.y,
            perte: Math.round(bp.perte / 100),
            items: [],
        };

        const keys = bp.val.split('-');
        keys.forEach((key) => {
            const idx = Number.parseInt(key, 10);
            if (Number.isNaN(idx) || !cartonsOrphelins[idx]) return;
            etage.items.push(cartonsOrphelins[idx].productId);
        });

        etagmixt[k] = etage;
        k += 1;
    });

    const etages = [...etagfull, ...etagfullmixt, ...etagmixt].sort((a, b) => (a.perte === b.perte ? 0 : a.perte > b.perte ? 1 : -1));

    const etagformat = etages.map((e) => ({ x: e.y }));
    const binpackRoll = myBinPacking.init({
        items: etagformat,
        tol: toleranceRoll,
    });

    const rollmixt: Roll[] = [];
    k = 0;
    binpackRoll.forEach((bp) => {
        if (!bp.val) return;
        const roll: Roll = { etages: [], perte: 0, coef: 0, nbetages: 0 };
        let loss = bp.perte;
        const keys = bp.val.split('-');
        keys.forEach((key) => {
            const idx = Number.parseInt(key, 10);
            if (Number.isNaN(idx) || !etages[idx]) return;
            roll.etages.push(etages[idx]);
            loss += etages[idx].perte;
        });
        roll.perte = loss;
        roll.coef = Math.round((100 - loss) * 10) / 10;
        roll.nbetages = roll.etages.length;
        rollmixt[k] = roll;
        k += 1;
    });

    rolls.push(...rollfull, ...rollmixt);
    return rolls;
};

export const buildRollDistribution = (items: CartItem[]): RollDistribution => {
    const suppliersTri = firstTri(items);
    const suppliers: Record<number, SupplierDistribution> = {};

    let totalRolls = 0;
    let totalFloors = 0;
    let totalCartons = 0;
    let totalLoss = 0;

    Object.entries(suppliersTri).forEach(([supplierIdRaw, supplierTri]) => {
        const supplierId = Number.parseInt(supplierIdRaw, 10);
        const rolls = supplierTri.mod_liv === 'roll' ? binpacking(supplierTri) : [];

        const rollCount = rolls.length;
        const floorCount = rolls.reduce((sum, roll) => sum + roll.etages.length, 0);
        const cartonCount = rolls.reduce((sum, roll) => sum + roll.etages.reduce((acc, etage) => acc + etage.items.length, 0), 0);
        const lossTotal = rolls.reduce((sum, roll) => sum + roll.perte, 0);
        const coefTotal = rolls.reduce((sum, roll) => sum + roll.coef, 0);
        const coefAvg = rollCount > 0 ? Math.round((coefTotal / rollCount) * 10) / 10 : 0;

        totalRolls += rollCount;
        totalFloors += floorCount;
        totalCartons += cartonCount;
        totalLoss += lossTotal;

        const producers: Record<number, ProducerDistribution> = {};
        Object.entries(supplierTri.producers).forEach(([producerIdRaw, producerTri]) => {
            const producerId = Number.parseInt(producerIdRaw, 10);
            const prodRolls = supplierTri.mod_liv === 'roll' ? binpacking(producerTri) : [];
            producers[producerId] = {
                producerId,
                rolls: prodRolls,
                rollCount: prodRolls.length,
                floorCount: prodRolls.reduce((sum, roll) => sum + roll.etages.length, 0),
                cartonCount: prodRolls.reduce((sum, roll) => sum + roll.etages.reduce((acc, etage) => acc + etage.items.length, 0), 0),
                lossTotal: prodRolls.reduce((sum, roll) => sum + roll.perte, 0),
            };
        });

        suppliers[supplierId] = {
            supplierId,
            name: supplierTri.name || `Supplier ${supplierId}`,
            country: supplierTri.country || '',
            mod_liv: supplierTri.mod_liv,
            mini: supplierTri.mini,
            rolls,
            rollCount,
            floorCount,
            cartonCount,
            coefAvg,
            coefTotal,
            lossTotal,
            producers,
            nonRollItems: supplierTri.nonRollItems,
        };
    });

    return {
        suppliers,
        totals: {
            rollCount: totalRolls,
            floorCount: totalFloors,
            cartonCount: totalCartons,
            lossTotal: totalLoss,
        },
    };
};

const getColorForId = (id: number): string => {
    const hue = (id * 47) % 360;
    return `hsl(${hue} 60% 60%)`;
};

const getFillClass = (coef: number): string => {
    if (coef >= 85) return 'text-emerald-600';
    if (coef >= 60) return 'text-amber-600';
    return 'text-rose-600';
};

const formatCurrency = (value: number): string =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const getFlag = (country: string) => {
    switch (country?.toLowerCase()) {
        case 'fr':
            return <FR title="France" className="w-6" />;
        case 'be':
            return <BE title="Belgium" className="w-6" />;
        case 'nl':
            return <NL title="Netherlands" className="w-6" />;
        case 'de':
            return <DE title="Germany" className="w-6" />;
        case 'es':
            return <ES title="Spain" className="w-6" />;
        case 'it':
            return <IT title="Italy" className="w-6" />;
        case 'en':
            return <GB title="United Kingdom" className="w-6" />;
        default:
            return (
                <div className="h-6 w-6 rounded-full bg-slate-900 text-[10px] font-bold uppercase text-white flex items-center justify-center">
                    {country ? country.slice(0, 2) : '??'}
                </div>
            );
    }
};

export function ProductRoll({
    items,
    className,
    width = 240,
    height = 350,
    onDistributionChange,
    getSupplierPrice,
}: ProductRollProps) {
    const distribution = useMemo(() => buildRollDistribution(items), [items]);

    useEffect(() => {
        onDistributionChange?.(distribution);
    }, [distribution, onDistributionChange]);

    const productMap = useMemo(() => {
        const map = new Map<number, Product>();
        items.forEach(({ product }) => {
            map.set(product.id, product);
        });
        return map;
    }, [items]);

    const suppliers = Object.values(distribution.suppliers);

    if (suppliers.length === 0) {
        return (
            <div className={cn('rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground', className)}>
                No roll distribution available.
            </div>
        );
    }
    // console.log(suppliers);
    return (
        <div className={cn('space-y-10', className)}>
            {suppliers.map((supplier) => (
                <section key={supplier.supplierId} className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-lg font-semibold text-foreground">
                                {supplier.name || `Supplier ${supplier.supplierId}`}
                            </div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                {supplier.country ? supplier.country : 'unknown'} · {supplier.mod_liv || 'roll'}
                                {supplier.mini > 0 ? ` · min ${supplier.mini}` : ''}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div>
                                <div className="text-xs text-muted-foreground">Rolls</div>
                                <div className="font-semibold">{supplier.rollCount}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Avg fill</div>
                                <div className={cn('font-semibold', getFillClass(supplier.coefAvg))}>{supplier.coefAvg}%</div>
                            </div>
                        </div>
                    </div>

                    {supplier.mod_liv !== 'roll' ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            This supplier is not configured for roll delivery.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {supplier.rolls.map((roll, rollIndex) => {
                                const totalY = roll.etages.reduce((sum, etage) => sum + (etage.y || 0), 0) || roll.etages.length;
                                const rollWidth = Math.max(160, width);
                                const rollHeight = Math.max(220, height);
                                const supplierPrice = getSupplierPrice ? getSupplierPrice(supplier) : null;
                                const rollBg = '';
                                const rollBorder = 'border-[#ac9c9c]';
                                return (
                                    <div key={`${supplier.supplierId}-${rollIndex}`} className="m-5">


                                        <div
                                            className={cn('relative', 'border-2 border-t-0 p-1', 'rounded-b-md', rollBorder, rollBg)}
                                            style={{ width: rollWidth + 12, height: rollHeight + 12 }}
                                        >
                                            <div className="absolute left-[-9px] top-2">{getFlag(supplier.country)}</div>
                                            <div
                                                className={cn(
                                                    'absolute right-[-14px] top-2 w-9 border border-slate-900 bg-white text-[11px] font-semibold text-center shadow-sm',
                                                    'bg-transparent'
                                                )}
                                            >
                                                <span className="rounded-full border border-slate-900 bg-white px-2 py-0.5 font-semibold text-slate-900 shadow-sm">
                                                    {roll.coef}%
                                                </span>
                                            </div>

                                            <div className="absolute left-1/2 -translate-x-1/2 -top-[20px] flex items-center gap-2 text-[11px]">
                                                <span className="rounded-full border border-slate-900 bg-white px-2 py-0.5 font-semibold text-slate-900 shadow-sm">
                                                    {supplierPrice !== null ? formatCurrency(supplierPrice) : 'devis'}
                                                </span>

                                            </div>


                                            <div
                                                className={cn('flex h-full w-full flex-col-reverse justify-start gap-0 bg-transparent p-0', 'rounded-b-sm')}
                                                style={{ width: rollWidth, height: rollHeight }}
                                            >
                                                {[...roll.etages]
                                                    .sort((a, b) => (b.y || 0) - (a.y || 0))
                                                    .map((etage, etageIndex) => {
                                                        const heightRatio = totalY ? (etage.y || 0) / totalY : 1 / roll.etages.length;
                                                        const etageHeight = Math.max(18, Math.floor(rollHeight * heightRatio));
                                                        const isFull = etage.perte === 0;
                                                        return (
                                                            <div
                                                                key={`${supplier.supplierId}-${rollIndex}-etage-${etageIndex}`}
                                                                className={cn(
                                                                    'flex border-b border-slate-900',
                                                                    isFull ? 'justify-between' : 'flex-wrap-reverse'
                                                                )}
                                                                style={{ height: etageHeight, marginTop: '2px' }}
                                                            >
                                                                {etage.items.map((productId, cartonIndex) => {
                                                                    const product = productMap.get(productId);
                                                                    const floor = Math.max(1, Math.floor(toNumber(product?.floor ?? 1)));
                                                                    const rollCount = Math.max(1, Math.floor(toNumber(product?.roll ?? roll.nbetages)));
                                                                    const cartonHeight = Math.max(12, Math.floor(rollHeight / rollCount));
                                                                    const widthPx = Math.max(10, Math.floor((rollWidth - Math.floor(floor / 5)) * 100 / floor) / 100);
                                                                    return (
                                                                        <div
                                                                            key={`${supplier.supplierId}-${rollIndex}-etage-${etageIndex}-carton-${cartonIndex}`}
                                                                            className={cn(
                                                                                'flex items-center justify-center bg-slate-300 border border-slate-400',
                                                                                isFull ? 'mr-0' : 'mr-px'
                                                                            )}
                                                                            style={{
                                                                                width: widthPx,
                                                                                height: cartonHeight,
                                                                                backgroundColor: getColorForId(productId),
                                                                            }}
                                                                            title={product ? product.name : `Product ${productId}`}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between text-slate-400" style={{ width: rollWidth + 12 }}>
                                            <span className="text-lg">⏻</span>
                                            <span className="text-lg">⏻</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
