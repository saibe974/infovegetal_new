import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, MoveVertical, CircleSlash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useContext, useState } from 'react';
import { addCartonIcon, addEtageIcon, addRollIcon } from '@/lib/icon';
import { Lens } from '@/components/ui/lens';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { type Product, SharedData } from '@/types';

const formatCurrency = (value: number): string =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const toNumber = (value: unknown): number | null => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

type Props = {
    product: Product;
    showBackLink?: boolean;
};

export default function ProductDetails({ product, showBackLink = true }: Props) {
    const { t } = useI18n();
    const { addToCart } = useContext(CartContext);
    const [quantity, setQuantity] = useState(1);
    const { toggleSidebar, isOpenId } = useSidebar();

    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const price = toNumber(product.price);
    const priceFloor = toNumber(product.price_floor);
    const priceRoll = toNumber(product.price_roll);
    const pricePromo = toNumber(product.price_promo);

    const handleAddToCart = () => {
        addToCart(product, quantity);
        !isOpenId('right') && toggleSidebar('right');
    };

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
                    <Card className="lg:w-1/2 lg:h-150">
                        <CardContent className="h-full flex items-center justify-center relative overflow-hidden">
                            {product.img_link ? (
                                <Lens
                                    zoomFactor={2.5}
                                    lensSize={200}
                                    isStatic={false}
                                    ariaLabel="Zoom Area"
                                >
                                    <img
                                        src={product.img_link || '/images/placeholder.png'}
                                        alt={product.name}
                                        className="h-full w-auto object-contain select-none"
                                        draggable={false}
                                    />
                                </Lens>
                            ) : (
                                <img
                                    src="/placeholder.png"
                                    alt={product.name}
                                    className="h-full w-auto object-contain select-none"
                                    draggable={false}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="lg:w-1/2 relative">
                        <CardHeader>
                            <CardTitle>
                                <h2 className="capitalize text-xl">{product.name}</h2>
                                {product.category && (
                                    <p className="text-sm text-muted-foreground mt-1 capitalize">
                                        {product.category.name}
                                    </p>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 w-full">
                            <p className="capitalize">
                                {product.description || t('Aucune description disponible')}
                            </p>
                        </CardContent>

                        {isAuthenticated && (
                            <CardFooter className="w-full flex flex-col gap-3 pt-6 mt-auto">
                                <div className="w-full h-px bg-black/10 dark:bg-accent rounded" />

                                <div className="flex flex-row gap-2 w-full">
                                    {price !== null && (
                                        <button
                                            className={cn(
                                                "w-1/3 flex flex-col items-center justify-center rounded-lg py-1",
                                                "bg-brand-tertiary hover:bg-brand-tertiary/90 text-white",
                                                "dark:text-black",
                                            )}
                                            onClick={(e: React.MouseEvent) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                addToCart(product, Number(product.cond));
                                            }}
                                            title={t('Add a tray')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="w-5 h-5">
                                                    <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                                </span>
                                                <span className="font-semibold">{formatCurrency(price)}</span>
                                            </div>
                                            <span className="text-xs font-light">X {String(product.cond)}</span>
                                        </button>
                                    )}
                                    {priceFloor !== null ? (
                                        <button
                                            className={cn(
                                                "w-1/3 flex flex-col items-center justify-center rounded-lg py-1",
                                                "bg-brand-secondary hover:bg-brand-secondary/90 text-white",
                                                "dark:text-black",
                                            )}
                                            onClick={(e: React.MouseEvent) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                addToCart(product, Number(product.cond) * Number(product.floor));
                                                !isOpenId('right') && toggleSidebar('right');
                                            }}
                                            title={t('Add a floor')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="w-5 h-5">
                                                    <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                                </span>
                                                <span className="font-semibold">{formatCurrency(priceFloor)}</span>
                                            </div>
                                            <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor)}</span>
                                        </button>
                                    ) : null}
                                    {priceRoll !== null ? (
                                        <button
                                            className={cn(
                                                "w-1/3 flex flex-col items-center justify-center rounded-lg py-1",
                                                "bg-brand-main hover:bg-brand-main-hover text-white",
                                                "dark:text-black",
                                            )}
                                            onClick={(e: React.MouseEvent) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                addToCart(product, Number(product.cond) * Number(product.floor) * Number(product.roll));
                                                !isOpenId('right') && toggleSidebar('right');
                                            }}
                                            title={t('Add a roll')}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="w-5 h-5">
                                                    <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                                </span>
                                                {pricePromo !== null ? (
                                                    <div className="flex flex-col md:flex-row md:gap-1 items-center">
                                                        <span className="font-semibold line-through opacity-75 text-xs leading-tight">
                                                            {formatCurrency(priceRoll)}
                                                        </span>
                                                        <span className="font-bold text-red-300 dark:text-red-600">
                                                            {formatCurrency(pricePromo)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="font-semibold">{formatCurrency(priceRoll)}</span>
                                                )}
                                            </div>
                                            <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor) * Number(product.roll)}</span>
                                        </button>
                                    ) : null}
                                </div>
                            </CardFooter>
                        )}
                    </Card>
                </div>

                <div className="space-y-6 w-full max-w-[1200px] md:mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Product Information')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-6">
                                    {product.tags && product.tags.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-3">{t('Tags')}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {product.tags.map((tag) => (
                                                    <Badge key={tag.id} variant="secondary" className="text-sm px-3 py-1">
                                                        {tag.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-sm font-semibold mb-3">{t('Product Characteristics')}</h3>
                                        <div className="space-y-3">
                                            {product.pot ? (
                                                <div className="flex items-center gap-2">
                                                    <CircleSlash2 className="size-5 text-main-purple dark:text-main-green mt-0.5" />
                                                    <div>
                                                        <div className="text-xs font-medium text-muted-foreground">{t('Diameter of the pot')}</div>
                                                        <div className="text-base font-semibold">{String(product.pot)} cm</div>
                                                    </div>
                                                </div>
                                            ) : null}
                                            {product.height ? (
                                                <div className="flex items-center gap-2">
                                                    <MoveVertical className="size-5 text-main-purple dark:text-main-green mt-0.5" />
                                                    <div>
                                                        <div className="text-xs font-medium text-muted-foreground">{t('Height')}</div>
                                                        <div className="text-base font-semibold">{String(product.height)} cm</div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold mb-3">{t('References')}</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs font-medium text-muted-foreground mb-1">SKU</div>
                                            <div className="text-sm font-mono bg-muted px-3 py-2 rounded">
                                                {String(product.sku) || 'N/A'}
                                            </div>
                                        </div>

                                        {product.ref ? (
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">{t('RReference')}</div>
                                                <div className="text-sm font-mono bg-muted px-3 py-2 rounded">
                                                    {String(product.ref)}
                                                </div>
                                            </div>
                                        ) : null}

                                        {product.ean13 ? (
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">{t('EAN13 Code')}</div>
                                                <div className="text-sm font-mono bg-muted px-3 py-2 rounded">
                                                    {String(product.ean13)}
                                                </div>
                                            </div>
                                        ) : null}

                                        <div>
                                            <div className="text-xs font-medium text-muted-foreground mb-1">{t('Product ID')}</div>
                                            <div className="text-sm font-mono bg-muted px-3 py-2 rounded">
                                                #{product.id}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
