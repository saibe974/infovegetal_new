import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';

type Props = {
    limit?: number;
    products: Product[];
};

export function ProductsCardsList({ limit = 4, products }: Props) {
    const { t } = useI18n();

    return (
        <div className="flex gap-10 flex-wrap">
            {products.slice(0, limit).map((product: any) => (
                <Card key={product.id} className=" h-4xl w-80 flex flex-col p-4 gap-4">
                    <CardHeader className="p-0">
                        <img src={product.img_link} alt={`Image de ${product.name}`} />
                    </CardHeader>

                    <CardTitle className="text-lg font-bold">
                        {product.name.charAt(0).toUpperCase() + String(product.name).slice(1)}
                    </CardTitle>

                    <CardContent className="p-0 max-w-40 overflow-ellipsis">
                        <p className="font-light text-sm text-nowrap overflow-hidden text-ellipsis">{product.description.charAt(0).toUpperCase() + String(product.description).slice(1)}</p>
                    </CardContent>

                    <div className="w-full h-1 bg-sidebar-accent rounded" />

                    <p className="font-light text-md">{product.price} €</p>
                    
                    <CardFooter className="w-full flex justify-end p-0">
                        <Button
                            className="bg-main-purple hover:bg-main-purple-hover dark:bg-main-green dark:hover:bg-main-green-hover hover:scale-105 transition-all duration-300"
                        >
                            {t('Ajouter au panier')}
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}