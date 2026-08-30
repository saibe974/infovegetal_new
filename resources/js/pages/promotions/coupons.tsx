import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withAppLayout } from '@/layouts/app-layout';
import { type CouponDiscountType, type CouponFunder, type CouponScope, type Promotion, type PromotionCoupon, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Calculator, Check, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

type Props = { promotion: Promotion; coupons: PromotionCoupon[] };

type CouponFormData = {
    code: string;
    discount_type: CouponDiscountType;
    discount_value: number | string;
    scope: CouponScope;
    funded_by: CouponFunder;
    minimum_order_ht: number | string;
    maximum_discount_ht: number | string;
    usage_limit: number | string;
    usage_limit_per_customer: number | string;
    starts_at: string;
    ends_at: string;
    stackable_with_promo_price: boolean;
    active: boolean;
};

type Simulation = {
    eligible_ht: number;
    discount_ht: number;
    final_ht: number;
    funder_margin_ht: number;
    funder_margin_after_ht: number;
    margin_sufficient: boolean;
    minimum_reached: boolean;
};

const emptyCoupon = (): CouponFormData => ({
    code: '', discount_type: 'percent', discount_value: 10, scope: 'promotion_products', funded_by: 'seller',
    minimum_order_ht: 0, maximum_discount_ht: '', usage_limit: '', usage_limit_per_customer: 1,
    starts_at: '', ends_at: '', stackable_with_promo_price: true, active: true,
});

const couponFormData = (coupon: PromotionCoupon): CouponFormData => ({
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    scope: coupon.scope,
    funded_by: coupon.funded_by,
    minimum_order_ht: coupon.minimum_order_ht,
    maximum_discount_ht: coupon.maximum_discount_ht ?? '',
    usage_limit: coupon.usage_limit ?? '',
    usage_limit_per_customer: coupon.usage_limit_per_customer,
    starts_at: coupon.starts_at ?? '',
    ends_at: coupon.ends_at ?? '',
    stackable_with_promo_price: coupon.stackable_with_promo_price,
    active: coupon.active,
});

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function CouponFields({ data, setData, errors }: {
    data: CouponFormData;
    setData: <K extends keyof CouponFormData>(key: K, value: CouponFormData[K]) => void;
    errors: Partial<Record<keyof CouponFormData, string>>;
}) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">Code
                <Input value={data.code} onChange={(e) => setData('code', e.target.value.toUpperCase())} placeholder="ETE2026" />
                <FieldError message={errors.code} />
            </label>
            <div className="grid grid-cols-[1fr_1fr] gap-2">
                <label className="space-y-1 text-sm">Remise
                    <Input type="number" min="0" step="0.01" value={data.discount_value} onChange={(e) => setData('discount_value', e.target.value)} />
                    <FieldError message={errors.discount_value} />
                </label>
                <label className="space-y-1 text-sm">Type
                    <Select value={data.discount_type} onValueChange={(value: CouponDiscountType) => setData('discount_type', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="percent">Pourcentage</SelectItem><SelectItem value="fixed">Montant HT</SelectItem></SelectContent>
                    </Select>
                </label>
            </div>
            <label className="space-y-1 text-sm">Portée
                <Select value={data.scope} onValueChange={(value: CouponScope) => setData('scope', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="promotion_products">Produits de la promotion</SelectItem><SelectItem value="cart">Panier complet</SelectItem></SelectContent>
                </Select>
            </label>
            <label className="space-y-1 text-sm">Remise financée par
                <Select value={data.funded_by} onValueChange={(value: CouponFunder) => setData('funded_by', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="seller">Vendeur</SelectItem><SelectItem value="billing_user">Facturant</SelectItem></SelectContent>
                </Select>
            </label>
            <label className="space-y-1 text-sm">Minimum de commande HT
                <Input type="number" min="0" step="0.01" value={data.minimum_order_ht} onChange={(e) => setData('minimum_order_ht', e.target.value)} />
                <FieldError message={errors.minimum_order_ht} />
            </label>
            <label className="space-y-1 text-sm">Plafond de remise HT <span className="text-muted-foreground">(facultatif)</span>
                <Input type="number" min="0" step="0.01" value={data.maximum_discount_ht} onChange={(e) => setData('maximum_discount_ht', e.target.value)} />
                <FieldError message={errors.maximum_discount_ht} />
            </label>
            <label className="space-y-1 text-sm">Limite globale <span className="text-muted-foreground">(vide = illimitée)</span>
                <Input type="number" min="1" step="1" value={data.usage_limit} onChange={(e) => setData('usage_limit', e.target.value)} />
                <FieldError message={errors.usage_limit} />
            </label>
            <label className="space-y-1 text-sm">Utilisations par client
                <Input type="number" min="1" step="1" value={data.usage_limit_per_customer} onChange={(e) => setData('usage_limit_per_customer', e.target.value)} />
                <FieldError message={errors.usage_limit_per_customer} />
            </label>
            <label className="space-y-1 text-sm">Début propre <span className="text-muted-foreground">(vide = promotion)</span>
                <Input type="datetime-local" value={data.starts_at} onChange={(e) => setData('starts_at', e.target.value)} />
                <FieldError message={errors.starts_at} />
            </label>
            <label className="space-y-1 text-sm">Fin propre <span className="text-muted-foreground">(vide = promotion)</span>
                <Input type="datetime-local" value={data.ends_at} onChange={(e) => setData('ends_at', e.target.value)} />
                <FieldError message={errors.ends_at} />
            </label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={data.stackable_with_promo_price} onCheckedChange={(v) => setData('stackable_with_promo_price', v === true)} />Cumulable avec les prix promo</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={data.active} onCheckedChange={(v) => setData('active', v === true)} />Coupon actif</label>
        </div>
    );
}

function SimulationPanel({ promotionId, coupon }: { promotionId: number; coupon: PromotionCoupon }) {
    const csrf = usePage<SharedData>().props.csrf_token ?? '';
    const [eligibleHt, setEligibleHt] = useState('100');
    const [marginHt, setMarginHt] = useState('20');
    const [result, setResult] = useState<Simulation | null>(null);
    const [loading, setLoading] = useState(false);

    const simulate = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/promotions/${promotionId}/coupons/${coupon.id}/simulate`, {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                body: JSON.stringify({ eligible_ht: Number(eligibleHt), funder_margin_ht: Number(marginHt) }),
            });
            if (response.ok) setResult(await response.json() as Simulation);
        } finally { setLoading(false); }
    };

    return (
        <div className="rounded-md border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2 font-medium"><Calculator className="size-4" />Simulation indicative</div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-1 text-xs">Montant éligible HT<Input type="number" min="0" step="0.01" value={eligibleHt} onChange={(e) => setEligibleHt(e.target.value)} /></label>
                <label className="space-y-1 text-xs">Marge disponible du financeur<Input type="number" min="0" step="0.01" value={marginHt} onChange={(e) => setMarginHt(e.target.value)} /></label>
                <Button type="button" variant="outline" className="self-end" onClick={simulate} disabled={loading}>Calculer</Button>
            </div>
            {result && <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>Remise : <strong>{result.discount_ht.toFixed(2)} € HT</strong></div>
                <div>Total après remise : <strong>{result.final_ht.toFixed(2)} € HT</strong></div>
                <div className={result.margin_sufficient ? 'text-emerald-700' : 'text-destructive'}>{result.margin_sufficient ? `Marge restante : ${result.funder_margin_after_ht.toFixed(2)} €` : `Marge insuffisante de ${Math.abs(result.funder_margin_after_ht).toFixed(2)} €`}</div>
                {!result.minimum_reached && <p className="sm:col-span-3 text-amber-700">Le minimum de commande n’est pas atteint : aucune remise.</p>}
            </div>}
        </div>
    );
}

function ExistingCoupon({ promotion, coupon }: { promotion: Promotion; coupon: PromotionCoupon }) {
    const { data, setData, put, processing, errors, isDirty } = useForm<CouponFormData>(couponFormData(coupon));
    const submit = (event: FormEvent) => { event.preventDefault(); put(`/promotions/${promotion.id}/coupons/${coupon.id}`, { preserveScroll: true }); };
    const remove = () => { if (window.confirm(`Supprimer le coupon ${coupon.code} ?`)) router.delete(`/promotions/${promotion.id}/coupons/${coupon.id}`, { preserveScroll: true }); };

    return <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
            <div><div className="flex items-center gap-2"><CardTitle>{coupon.code}</CardTitle><Badge variant={coupon.active ? 'outline' : 'secondary'}>{coupon.active ? 'Actif' : 'Inactif'}</Badge></div><CardDescription>Dates vides : héritage automatique de la promotion.</CardDescription></div>
            <Button type="button" variant="ghost" size="icon" onClick={remove} aria-label={`Supprimer ${coupon.code}`}><Trash2 /></Button>
        </CardHeader>
        <CardContent className="space-y-5">
            <form onSubmit={submit} className="space-y-4"><CouponFields data={data} setData={setData} errors={errors} /><div className="flex justify-end"><Button disabled={processing || !isDirty}><Check />Enregistrer</Button></div></form>
            <SimulationPanel promotionId={promotion.id} coupon={coupon} />
        </CardContent>
    </Card>;
}

export default withAppLayout<Props>(
    [{ title: 'Promotions', href: '/promotions' }, { title: 'Coupons', href: '/promotions' }],
    false,
    ({ promotion, coupons }) => {
        const { data, setData, post, processing, errors, reset } = useForm<CouponFormData>(emptyCoupon());
        const submit = (event: FormEvent) => { event.preventDefault(); post(`/promotions/${promotion.id}/coupons`, { preserveScroll: true, onSuccess: () => reset() }); };

        return <>
            <Head title={`Coupons — ${promotion.title}`} />
            <div className="mb-5"><h1 className="text-2xl font-semibold">{promotion.title}</h1><p className="text-sm text-muted-foreground">Créez plusieurs codes et vérifiez leur impact avant de les rendre utilisables.</p></div>
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <PromotionWorkspaceNav promotionId={promotion.id} active="coupons" />
                <div className="space-y-6">
                    {Object.keys(errors).length > 0 && <Alert variant="destructive"><AlertCircle /><AlertTitle>Coupon non enregistré</AlertTitle><AlertDescription>Vérifiez les champs signalés.</AlertDescription></Alert>}
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5" />Nouveau coupon</CardTitle><CardDescription>Le code est commun à tous les clients pour cette première version.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-5"><CouponFields data={data} setData={setData} errors={errors} /><div className="flex justify-end"><Button disabled={processing}><Plus />Créer le coupon</Button></div></form></CardContent></Card>
                    {coupons.length === 0 ? <Alert><AlertTitle>Aucun coupon</AlertTitle><AlertDescription>La promotion peut rester une simple sélection de produits.</AlertDescription></Alert> : coupons.map((coupon) => <ExistingCoupon key={coupon.id} promotion={promotion} coupon={coupon} />)}
                </div>
            </div>
        </>;
    },
);
