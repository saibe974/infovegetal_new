import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, MoveVertical, CircleSlash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useContext } from 'react';
import { Lens } from '@/components/ui/lens';
import { cn, formatCurrency } from '@/lib/utils';
import { type Product, SharedData } from '@/types';
import { resolveProductPrices } from '@/lib/resolve-product-prices';
import { ProductOrderButtons } from '@/components/products/product-order-buttons';

type Props = {
    product: Product;
    showBackLink?: boolean;
};

export default function ProductDetails({ product, showBackLink = true }: Props) {
    const { t } = useI18n();
    const { items } = useContext(CartContext);
    const isInCart = items.some((cartItem) => cartItem.product.id === product.id);

    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const { price, price_floor: priceFloor, price_roll: priceRoll } = resolveProductPrices(product);
    const canOrder = isAuthenticated && (price !== null || priceFloor !== null || priceRoll !== null);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {showBackLink && (
                        <Link
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.history.back();
                            }}
                            className="hover:text-gray-500 transition-colors duration-200"
                        >
                            <ArrowLeftCircle size={35} />
                        </Link>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold capitalize">{product.name}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {product.active ? (
                        <Badge variant="default" className="bg-green-600">{t('En stock')}</Badge>
                    ) : (
                        <Badge variant="destructive">{t('Rupture')}</Badge>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="gap-5 flex flex-col lg:flex-row lg:flex lg:justify-center w-full max-w-[1200px] md:mx-auto">
                    <Card className={cn('lg:w-1/2 lg:h-150', isInCart && 'border-green-200/70 ring-1 ring-green-300/60 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20')}>
                        <CardContent className="h-full flex items-center justify-center relative overflow-hidden">
                            {product.img_link ? (
                                <Lens
                                    zoomFactor={2.5}
                                    lensSize={200}
                                    isStatic={false}
                                    ariaLabel="Zoom Area"
                                >
                                    <img
                                        src={product.image_original ?? product.img_link ?? '/images/placeholder.png'}
                                        alt={product.name}
                                        className="h-full w-auto object-contain select-none"
                                        draggable={false}
                                    />
                                </Lens>
                            ) : (
                                <img
                                    src={'/placeholder.png'}
                                    alt={product.name}
                                    className="h-full w-auto object-contain select-none"
                                    draggable={false}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className={cn('lg:w-1/2 relative', isInCart && 'border-green-200/70 ring-1 ring-green-300/60 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20')}>
                        <CardHeader>
                            <CardTitle>
                                <h2 className="capitalize text-xl">{product.name}</h2>
                                {product.ref && (
                                    <p className="text-sm text-muted-foreground mt-1 font-mono">
                                        Ref: {String(product.ref)}
                                    </p>
                                )}
                                {product.category && (
                                    <p className="text-sm text-muted-foreground mt-1 capitalize">
                                        {product.category.name}
                                    </p>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 w-full flex flex-col h-full">
                            <p className="capitalize">
                                {product.description || t('Aucune description disponible')}
                            </p>

                            {/* <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                    {t('Prix TTC')}
                                </div>
                                <div className="text-3xl font-black leading-none">
                                    {formatCurrency(displayPrice)}
                                </div>
                            </div> */}

                            <div className="space-y-4">
                                {product.tags && product.tags.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold mb-2">{t('Tags')}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {product.tags.map((tag) => (
                                                <Badge key={tag.id} variant="secondary" className="text-xs px-2 py-0.5">
                                                    {tag.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* <div> */}
                                {/* <h3 className="text-sm font-semibold mb-2">{t('Product Characteristics')}</h3> */}
                                <div className="space-y-2">
                                    {product.pot ? (
                                        <div className="flex items-center gap-2">
                                            <CircleSlash2 className="size-4 text-main-purple dark:text-main-green" />
                                            <div className="text-sm">
                                                <span className="text-muted-foreground" title="{t('Diameter of the pot')}"></span>{' '}
                                                <span className="font-semibold">{String(product.pot)} cm</span>
                                            </div>
                                        </div>
                                    ) : null}
                                    {product.height ? (
                                        <div className="flex items-center gap-2">
                                            <MoveVertical className="size-4 text-main-purple dark:text-main-green" />
                                            <div className="text-sm">
                                                <span className="text-muted-foreground" title="{t('Height')}"></span>{' '}
                                                <span className="font-semibold">{String(product.height)} cm</span>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                {/* </div> */}

                                {product.ean13 && (
                                    <div className='flex items-baseline gap-2'>
                                        <h3 className="text-sm font-semibold mb-2">{t('EAN13 Code')} :</h3>
                                        <div className="text-sm text-muted-foreground font-mono">
                                            {String(product.ean13)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>

                        {canOrder && (
                            <>
                                <CardFooter className="w-full flex flex-col gap-3 pt-4 mt-auto">
                                    <div className="relative w-full">
                                        <div className="w-full h-px bg-black/10 dark:bg-accent rounded" />
                                        {product?.unite != null && product.unite > Number(product.cond) ? (
                                            <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 bg-card px-2 text-xs text-muted-foreground">
                                                {t('Mini')} : {String(product.unite)}
                                            </span>
                                        ) : null}
                                    </div>

                                    <ProductOrderButtons product={product} className="flex w-full flex-row" />
                                </CardFooter>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
