import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem, Product } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@inertiajs/react';
import { ArrowLeftCircle } from 'lucide-react';

type Props = {
    product: Product;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

export default withAppLayout<Props>(breadcrumbs, ({ product }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href={products.index()} className="hover:opacity-70">
                    <ArrowLeftCircle size={24} />
                </Link>
                <h1 className="text-3xl font-bold">{product.name}</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <div className="space-y-6">
                    {product.img_link && (
                        <Card>
                            <CardContent className="pt-6">
                                <img
                                    src={product.img_link}
                                    alt={product.name}
                                    className="w-full h-auto object-cover rounded-lg"
                                />
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                {product.description || 'Aucune description disponible'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informations</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Prix</div>
                                <div className="text-lg font-semibold">
                                    {product.price ? `${product.price} €` : 'N/A'}
                                </div>
                            </div>

                            {product.category && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">Catégorie</div>
                                    <div className="text-lg">{product.category.name}</div>
                                </div>
                            )}

                            <div>
                                <div className="text-sm font-medium text-muted-foreground mb-2">SKU</div>
                                <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                    {product.sku ? String(product.sku) : 'N/A'}
                                </div>
                            </div>

                            {product.tags && product.tags.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Tags</div>
                                    <div className="flex flex-wrap gap-2">
                                        {product.tags.map((tag) => (
                                            <Badge key={tag.id} variant="secondary">
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {(product.stock_quantity !== null || product.unit !== null) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Stock</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {product.stock_quantity !== null && product.stock_quantity !== undefined && (
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Quantité</div>
                                        <div className="text-lg">{String(product.stock_quantity)}</div>
                                    </div>
                                )}
                                {typeof product.unit !== 'undefined' && product.unit !== null && (
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Unité</div>
                                        <div className="text-lg">{String(product.unit)}</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
});
