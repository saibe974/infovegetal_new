import { CartContext } from '@/components/cart/cart.context';
import { ProductOrderButtons } from '@/components/products/product-order-buttons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CountryFlag } from '@/components/ui/country-flag';
import { useI18n } from '@/lib/i18n';
import { resolveProductPrices } from '@/lib/resolve-product-prices';
import { cn } from '@/lib/utils';
import { Product, SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    CircleSlash2,
    Edit,
    MoveVertical,
    Trash2,
    X,
    Zap,
} from 'lucide-react';
import { useContext } from 'react';
import './products-small-cards.css';

type Props = {
    products: Product[];
    canEdit?: boolean;
    canDelete?: boolean;
    showStatusBadge?: boolean;
};

export function ProductsSmallCardsList({
    products,
    canEdit = false,
    canDelete = false,
    showStatusBadge = false,
}: Props) {
    const { t } = useI18n();
    const { auth } = usePage<SharedData>().props;
    const { items } = useContext(CartContext);

    const buildShowUrl = (id: number) => {
        if (typeof window === 'undefined') return `/products/${id}`;
        const params = new URLSearchParams(window.location.search);
        return params.get('q')
            ? `/products/${id}?from=search`
            : `/products/${id}`;
    };

    const deleteProduct = (productId: number) => {
        if (confirm(t('Êtes-vous sûr de vouloir supprimer ce produit ?'))) {
            router.visit(`/admin/products/${productId}/destroy`, {
                method: 'delete',
            });
        }
    };

    return (
        <div className="products-small-cards-list flex w-full flex-wrap justify-center gap-4">
            {products.map((product) => {
                const name = String(product.name ?? '');
                const description = String(product.description ?? '');
                const image =
                    product.image_thumb ??
                    product.image_medium ??
                    product.img_link ??
                    '/placeholder.png';
                const countryCode = (product.dbProduct?.country ?? '')
                    .trim()
                    .toUpperCase();
                const isInCart = items.some(
                    (item) => item.product.id === product.id,
                );
                const {
                    price,
                    price_floor: priceFloor,
                    price_roll: priceRoll,
                    price_promo: pricePromo,
                } = resolveProductPrices(product);
                const canOrder =
                    Boolean(auth?.user) &&
                    (price !== null ||
                        priceFloor !== null ||
                        priceRoll !== null);

                return (
                    <Link
                        key={product.id}
                        href={buildShowUrl(product.id)}
                        className="product-small-card group no-underline hover:no-underline"
                    >
                        <Card
                            className={cn(
                                'h-full gap-3 overflow-hidden p-3 transition-shadow group-hover:shadow-md',
                                isInCart &&
                                    'border-green-200/70 bg-green-50/60 ring-1 ring-green-300/60 dark:border-green-900 dark:bg-green-950/20',
                            )}
                        >
                            <div className="flex min-w-0 gap-3">
                                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md sm:h-32 sm:w-36">
                                    <img
                                        src={image}
                                        alt={name}
                                        className="h-full w-full object-cover"
                                    />
                                    {countryCode ? (
                                        <span className="absolute top-1.5 right-1.5 rounded border bg-white/90 px-1 py-0.5 shadow-sm">
                                            <CountryFlag
                                                countryCode={countryCode}
                                                title={countryCode}
                                                className="w-4"
                                            />
                                        </span>
                                    ) : null}
                                    {(canEdit || canDelete) && (
                                        <div
                                            className={cn(
                                                'absolute right-1.5 flex flex-col gap-1',
                                                countryCode
                                                    ? 'top-8'
                                                    : 'top-1.5',
                                            )}
                                        >
                                            {canEdit && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 border border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                                                    title={t('Edit product')}
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        router.visit(
                                                            `/admin/products/${product.id}/edit`,
                                                        );
                                                    }}
                                                >
                                                    <Edit className="size-3.5" />
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 border border-border bg-background/90 text-destructive shadow-sm backdrop-blur-sm hover:bg-background hover:text-destructive"
                                                    title={t('Delete product')}
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        deleteProduct(
                                                            product.id,
                                                        );
                                                    }}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {pricePromo > 0 ? (
                                        <span
                                            className="absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-red-600 text-white"
                                            title={t('PROMO')}
                                        >
                                            <Zap className="size-4" />
                                        </span>
                                    ) : null}
                                </div>

                                <div className="product-small-card__info flex min-w-0 flex-1 flex-col">
                                    <div className="min-w-0">
                                        <div className="min-w-0">
                                            <h3 className="product-small-card__title font-semibold group-hover:underline group-hover:underline-offset-2">
                                                {name.charAt(0).toUpperCase() +
                                                    name.slice(1)}
                                            </h3>
                                            {product.ref ? (
                                                <p className="truncate text-xs text-muted-foreground italic">
                                                    {t('Ref')}:{' '}
                                                    {String(product.ref)}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    <p className="product-small-card__description mt-2 line-clamp-2 text-sm text-muted-foreground">
                                        {description.charAt(0).toUpperCase() +
                                            description.slice(1)}
                                    </p>

                                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
                                        {product.pot ? (
                                            <span
                                                className="flex items-center gap-1"
                                                title={t('Diameter of the pot')}
                                            >
                                                <CircleSlash2 className="size-3.5" />{' '}
                                                {String(product.pot)} cm
                                            </span>
                                        ) : null}
                                        {product.height ? (
                                            <span
                                                className="flex items-center gap-1"
                                                title={t('Height')}
                                            >
                                                <MoveVertical className="size-3.5" />{' '}
                                                {String(product.height)} cm
                                            </span>
                                        ) : null}
                                        {showStatusBadge ? (
                                            <span
                                                className={cn(
                                                    'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-white',
                                                    product.active
                                                        ? 'bg-green-600'
                                                        : 'bg-red-500',
                                                )}
                                            >
                                                {product.active ? (
                                                    <Check className="size-3" />
                                                ) : (
                                                    <X className="size-3" />
                                                )}
                                                {product.active
                                                    ? t('In stock')
                                                    : t('Out of stock')}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {canOrder ? (
                                <div className="space-y-3">
                                    <div className="relative w-full">
                                        <div className="h-px w-full rounded bg-black/10 dark:bg-accent" />
                                        {product.unite != null &&
                                        product.unite > Number(product.cond) ? (
                                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-card px-2 text-xs whitespace-nowrap text-muted-foreground">
                                                {t('Mini')} :{' '}
                                                {String(product.unite)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <ProductOrderButtons
                                        product={product}
                                        className="grid grid-cols-3"
                                    />
                                </div>
                            ) : null}
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}
