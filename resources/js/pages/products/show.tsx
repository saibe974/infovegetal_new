import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem, Product, SharedData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, MoveVertical, CircleSlash2, ShoppingCart, Minus, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useContext, useState, useRef } from 'react';
import { addCartonIcon, addEtageIcon, addRollIcon } from '@/lib/icon';
import { Input } from '@/components/ui/input';
import { Lens } from '@/components/ui/lens';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type Props = {
    product: Product;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

export default withAppLayout<Props>(breadcrumbs, false, ({ product }) => {
    const { t } = useI18n();
    const { addToCart } = useContext(CartContext);
    const [quantity, setQuantity] = useState(1);
    const { toggleSidebar, isOpenId } = useSidebar();

    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const handleAddToCart = () => {
        addToCart(product, quantity);
        !isOpenId('right') && toggleSidebar('right');
    };


    // console.log(product);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
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

            <div className=" flex flex-col gap-6">
                <div className="gap-5 flex flex-col lg:flex-row lg:flex lg:justify-center w-full max-w-[1200px] md:mx-auto">
                    {/* {product.img_link && ( */}
                    <Card className='lg:w-1/2 lg:h-150'>
                        <CardContent
                            className="h-full flex items-center justify-center relative overflow-hidden"

                        >{product.img_link ?
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
                            : (
                                <img
                                    src="/placeholder.png"
                                    alt={product.name}
                                    className="h-full w-auto object-contain select-none"
                                    draggable={false}
                                />
                            )
                            }
                        </CardContent>
                    </Card>
                    {/* )} */}

                    <Card className="lg:w-1/2 relative">
                        <CardHeader>
                            <CardTitle>
                                <h2 className='capitalize text-xl'>{product.name}</h2>
                                {product.category && (
                                    <p className="text-sm text-muted-foreground mt-1 capitalize">
                                        {product.category.name}
                                    </p>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 w-full">
                            <p className=" capitalize">
                                {product.description || t('Aucune description disponible')}
                            </p>
                            {/* {product.price && (
                                <div className="flex items-center gap-3 pb-3 border-b">
                                    <span className="text-brand-tertiary w-7 h-7 flex-shrink-0">
                                        <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                    </span>
                                    <div className="flex-1">
                                        <div className="text-xl font-bold">{product.price} €</div>
                                        <div className="text-xs text-muted-foreground">X {Number(product.cond)}</div>
                                    </div>
                                </div>
                            )}
                            {product.price_floor ? (
                                <div className="flex items-center gap-3 pb-3 border-b">
                                    <span className="text-brand-secondary w-7 h-7 flex-shrink-0">
                                        <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                    </span>
                                    <div className="flex-1">
                                        <div className="text-xl font-semibold">{String(product.price_floor)} €</div>
                                        <div className="text-xs text-muted-foreground">X {Number(product.cond) * Number(product.floor)}</div>
                                    </div>
                                </div>
                            ) : null}
                            {product.price_roll ? (
                                <div className="flex items-center gap-3">
                                    <span className="text-brand-main w-7 h-7 flex-shrink-0">
                                        <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                    </span>
                                    <div className="flex-1">
                                        {product.price_promo ? (
                                            <div>
                                                <div className="text-xl font-semibold line-through text-gray-400">
                                                    {String(product.price_roll)} €
                                                </div>
                                                <div className="text-2xl font-bold text-red-600">
                                                    {String(product.price_promo)} €
                                                </div>
                                                <div className="text-xs text-muted-foreground">X {Number(product.cond) * Number(product.roll)}</div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="text-xl font-semibold">{String(product.price_roll)} €</div>
                                                <div className="text-xs text-muted-foreground">X {Number(product.cond) * Number(product.roll)}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null} */}


                        </CardContent>

                        {isAuthenticated && (
                            <CardFooter className='w-full flex flex-col gap-3 pt-6 mt-auto'>
                    
                                <div className="w-full h-px bg-black/10 dark:bg-accent rounded" />

                                <div className="flex flex-row gap-2 w-full">
                                    {product?.price && (
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
                                                <span className="font-semibold">{product.price} €</span>
                                            </div>
                                            <span className="text-xs font-light">X {String(product.cond)}</span>
                                        </button>
                                    )}
                                    {product?.price_floor ? (
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
                                                <span className="font-semibold">{String(product.price_floor)} €</span>
                                            </div>
                                            <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor)}</span>
                                        </button>
                                    ) : null}
                                    {product?.price_roll ? (
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
                                                {product?.price_promo ? (
                                                    <div className="flex flex-col md:flex-row md:gap-1 items-center">
                                                        <span className="font-semibold line-through opacity-75 text-xs leading-tight">
                                                            {String(product.price_roll)} €
                                                        </span>
                                                        <span className="font-bold text-red-300 dark:text-red-600">
                                                            {String(product.price_promo)} €
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="font-semibold">{String(product.price_roll)} €</span>
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
                    <Card className=''>
                        <CardHeader>
                            <CardTitle>{t('Product Information')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Colonne gauche: Tags et Caractéristiques */}
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
                                            {/* {product.cond !== null && product.cond !== undefined && (
                                                <div>
                                                    <div className="text-xs font-medium text-muted-foreground">{t('Conditionnement')}</div>
                                                    <div className="text-base font-semibold">{String(product.cond)}</div>
                                                </div>
                                            )}
                                            {product.floor !== null && product.floor !== undefined && (
                                                <div>
                                                    <div className="text-xs font-medium text-muted-foreground">{t('Unités par palette')}</div>
                                                    <div className="text-base font-semibold">{String(product.floor)}</div>
                                                </div>
                                            )}
                                            {product.roll !== null && product.roll !== undefined && (
                                                <div>
                                                    <div className="text-xs font-medium text-muted-foreground">{t('Unités par roll')}</div>
                                                    <div className="text-base font-semibold">{String(product.roll)}</div>
                                                </div>
                                            )} */}
                                        </div>
                                    </div>
                                </div>

                                {/* Colonne droite: Références */}
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

                    {/* {(product.stock_quantity !== null || product.unit !== null) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('Stock')}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {product.stock_quantity !== null && product.stock_quantity !== undefined && (
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground">{t('Quantité')}</div>
                                        <div className="text-lg font-semibold">{String(product.stock_quantity)}</div>
                                    </div>
                                )}
                                {typeof product.unit !== 'undefined' && product.unit !== null && (
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground">{t('Unité')}</div>
                                        <div className="text-lg font-semibold">{String(product.unit)}</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )} */}
                </div>
            </div>
        </div >
    );
});
