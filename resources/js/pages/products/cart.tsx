import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem, type Product, SharedData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, Minus, Plus, SaveIcon, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useContext, useEffect, useState } from 'react';
import { StickyBar } from '@/components/ui/sticky-bar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import BasicSticky from 'react-sticky-el';
import { ButtonsActions } from '@/components/buttons-actions';
import { ProductRoll } from '@/components/products/product-roll';

type Props = Record<string, never>;

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

const transportTaxOptions = [
    { value: 0, label: '0 (0%)', rate: 0 },
    { value: 1, label: '1 (5%)', rate: 0.05 },
    { value: 2, label: '2 (10%)', rate: 0.1 },
    { value: 3, label: '3 (20%)', rate: 0.2 },
];

const countries = [
    { value: 'fr', label: 'France' },
    { value: 'be', label: 'Belgique' },
    { value: 'nl', label: 'Hollande' },
];

// Basic shipping multipliers per country; replace with real rates when available.
const countryShippingMultiplier: Record<string, number> = {
    fr: 0.02,
    be: 0.03,
    nl: 0.035,
};

const formatCurrency = (value: number) =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const toText = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

export default withAppLayout<Props>(breadcrumbs, false, () => {
    const { t } = useI18n();
    const { items, updateQuantity, removeFromCart, clearCart } = useContext(CartContext);
    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const [country, setCountry] = useState(countries[0].value);
    const [transportTax, setTransportTax] = useState<number>(transportTaxOptions[0].value);
    const [deliveryDate, setDeliveryDate] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);


    const getUnitPrice = (product: Product) => {
        const promo = toNumber((product as any).price_promo);
        const roll = toNumber((product as any).price_roll);
        const floor = toNumber((product as any).price_floor);
        const base = toNumber(product.price);

        if (promo > 0) return promo;
        if (roll > 0) return roll;
        if (floor > 0) return floor;
        return base;
    };

    const itemsTotal = items.reduce((sum, { product, quantity }) => sum + getUnitPrice(product) * quantity, 0);

    const selectedRate = transportTaxOptions.find((option) => option.value === transportTax)?.rate ?? 0;
    const deliveryBase = itemsTotal * (countryShippingMultiplier[country] ?? 0);
    const deliveryTotal = deliveryBase * (1 + selectedRate);
    const orderTotal = itemsTotal + deliveryTotal;

    const handleQuantityChange = (productId: number, next: number) => {
        updateQuantity(productId, Math.max(1, next || 1));
    };

    const handleSaveCart = async () => {
        if (items.length === 0) {
            setSaveMessage("Le panier est vide");
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const csrfToken = (
                document.querySelector(
                    'meta[name="csrf-token"]'
                ) as HTMLMetaElement
            )?.content;

            const response = await fetch("/cart/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken || "",
                },
                body: JSON.stringify({
                    items: items.map((item) => ({
                        id: item.product.id,
                        quantity: item.quantity,
                    })),
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSaveMessage("Panier enregistré avec succès");
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                setSaveMessage(
                    data.message || "Erreur lors de la sauvegarde"
                );
            }
        } catch (error) {
            console.error("Error saving cart:", error);
            setSaveMessage("Erreur lors de la sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (items.length === 0) {
            setSaveMessage("Le panier est vide");
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const csrfToken = (
                document.querySelector(
                    'meta[name="csrf-token"]'
                ) as HTMLMetaElement
            )?.content;

            const response = await fetch("/cart/generate-pdf", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken || "",
                },
                body: JSON.stringify({
                    items: items.map((item) => ({
                        id: item.product.id,
                        quantity: item.quantity,
                    })),
                }),
            });

            if (response.ok) {
                // Créer un blob à partir de la réponse
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `panier-${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                setSaveMessage("PDF généré avec succès");
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                const data = await response.json();
                setSaveMessage(
                    data.message || "Erreur lors de la génération du PDF"
                );
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
            setSaveMessage("Erreur lors de la génération du PDF");
        } finally {
            setIsSaving(false);
        }
    };
    const [topOffset, setTopOffset] = useState<number>(0);

    useEffect(() => {
        const getHeight = () => {
            const header = document.querySelector('.top-sticky') as HTMLElement | null;
            const stickyBar = document.querySelector('.sticky-bar-cart') as HTMLElement | null;

            if (!header || !stickyBar) return 0;

            const headerHeight = header.getBoundingClientRect().height;
            const barHeight = stickyBar.getBoundingClientRect().height;
            const total = headerHeight + barHeight;

            // console.log('header height:', headerHeight, 'bar height:', barHeight, 'total:', total);
            return total;
        };

        const update = () => {
            const height = getHeight();
            if (height > 0) {
                setTopOffset(height);
            }
        };

        // Attendre que le rendu soit complet et que le layout soit stable
        requestAnimationFrame(() => {
            setTimeout(() => {
                update();
                // Vérifier à nouveau après un délai
                setTimeout(update, 200);
            }, 50);
        });

        // Mettre à jour sur resize
        const handleResize = () => {
            requestAnimationFrame(update);
        };
        window.addEventListener('resize', handleResize);



        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="">
            <Head title={t('Cart')} />
            <StickyBar
                zIndex={20}
                borderBottom={false}
                className='mb-4 sticky-bar-cart'
            >
                <div className='flex items-center justify-between w-full py-2'>
                    <div className="flex items-center gap-3">
                        <Link
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.history.back();
                            }}
                            className="hover:text-gray-500 transition-colors duration-200"
                        >
                            <ArrowLeftCircle size={32} />
                        </Link>
                        <h1 className="text-3xl font-bold">{t('Panier')}</h1>
                    </div>

                    {items.length > 0 && (
                        // <div className='space-x-2'>

                        //     <Button variant="default" onClick={handleSaveCart} className="" size="sm" disabled={isSaving}>
                        //         {t('Save')} <SaveIcon className="h-4 w-4" />
                        //     </Button>
                        //     <Button variant="ghost" onClick={clearCart} className="text-destructive" size="sm" disabled={isSaving}>
                        //         {t('Clear')}<Trash2 className="h-4 w-4" />
                        //     </Button>
                        // </div>
                        <ButtonsActions
                            save={handleSaveCart}
                            delete={clearCart}
                        />
                    )}
                </div>
            </StickyBar>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {t('Produits')} ({items.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {items.length === 0 && (
                                <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                                    <p>{t('Votre panier est vide')}</p>
                                    <Button asChild>
                                        <Link href={products.index().url}>{t('Voir les produits')}</Link>
                                    </Button>
                                </div>
                            )}

                            {items.map(({ product, quantity }) => {
                                const unitPrice = getUnitPrice(product);
                                const lineTotal = unitPrice * quantity;

                                return (
                                    <div
                                        key={product.id}
                                        className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center"
                                    >
                                        <div className="flex items-center gap-4 md:w-1/2">
                                            <div className="h-20 w-20 rounded relative shrink-0">
                                                <img
                                                    src={product.img_link || '/images/placeholder.png'}
                                                    alt={product.name}
                                                    className="h-full w-full object-cover"
                                                />
                                                <Badge
                                                    // variant={''}
                                                    className={cn(
                                                        "absolute -top-1 -right-1 text-xs rounded-full",
                                                        quantity > 9 ? "size-6 px-1.5" : "size-5 px-2"
                                                    )}
                                                >
                                                    {quantity}
                                                </Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold leading-tight line-clamp-2 capitalize">{product.name}</p>
                                                {toText((product as any).ref) ? (
                                                    <p className="text-xs text-muted-foreground">Ref: {toText((product as any).ref)}</p>
                                                ) : null}
                                                <p className="text-xs text-muted-foreground">{t('Prix unitaire')}</p>
                                                <p className="text-base font-semibold">{formatCurrency(unitPrice)}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-1 flex-wrap items-center justify-between gap-4 md:justify-end">
                                            <div className="flex items-center gap-3 bg-muted rounded-lg p-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    aria-label={t('Diminuer la quantité')}
                                                    onClick={() => handleQuantityChange(product.id, quantity - 1)}
                                                    disabled={quantity <= 1}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Input
                                                    type="text"
                                                    min={1}
                                                    value={quantity}
                                                    onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value, 10))}
                                                    className="w-16 h-8 text-center border-0"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    aria-label={t('Augmenter la quantité')}
                                                    onClick={() => handleQuantityChange(product.id, quantity + 1)}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">{t('Total ligne')}</p>
                                                <p className="text-lg font-semibold">{formatCurrency(lineTotal)}</p>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                className="text-destructive"
                                                onClick={() => removeFromCart(product.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Rolls')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProductRoll items={items} />
                        </CardContent>
                    </Card>
                </div>

                <BasicSticky
                    topOffset={-topOffset}
                    stickyStyle={{ top: topOffset, }}
                >
                    <Card
                        className="h-fit sidebar"
                    >
                        <CardHeader>
                            <CardTitle>{t('Récapitulatif')}</CardTitle>
                            {saveMessage && (
                                <div
                                    className={`mt-2 text-sm p-2 rounded ${saveMessage.includes("Erreur")
                                        ? " text-destructive border border-destructive"
                                        : " text-green-600 border border-green-600"
                                        }`}
                                >
                                    {saveMessage}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span>{t('Total produits')}</span>
                                <span className="font-semibold">{formatCurrency(itemsTotal)}</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('Pays de livraison')}</label>
                                <Select value={country} onValueChange={(value) => setCountry(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Sélectionner un pays')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {countries.map((countryOption) => (
                                            <SelectItem key={countryOption.value} value={countryOption.value}>
                                                {countryOption.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('Taxe transport')}</label>
                                <Select
                                    value={String(transportTax)}
                                    onValueChange={(value) => setTransportTax(Number(value))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Sélectionner une taxe')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {transportTaxOptions.map((option) => (
                                            <SelectItem key={option.value} value={String(option.value)}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('Date de livraison souhaitée')}</label>
                                <Input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                />
                            </div>

                            <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>{t('Total livraison TTC')}</span>
                                    <span className="font-semibold">{formatCurrency(deliveryTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-base font-semibold">
                                    <span>{t('Total')}</span>
                                    <span>{formatCurrency(orderTotal)}</span>
                                </div>
                            </div>



                            <Button
                                className="w-full bg-brand-main hover:bg-brand-main-hover"
                                size="lg"
                                disabled={items.length === 0 || isSaving}
                                onClick={handleGeneratePdf}
                            >
                                {t('Commander')}
                            </Button>
                        </CardContent>
                    </Card>
                </BasicSticky>
            </div>
        </div>
    );
});
