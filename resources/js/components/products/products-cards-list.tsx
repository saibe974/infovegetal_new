import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { type Product } from '@/types';
import { Link, router } from "@inertiajs/react";
import { CameraIcon, Check, CircleCheckBig, CircleOff, CircleX, EditIcon, TrashIcon, X } from "lucide-react";
import storage from "@/routes/storage";
import { ProductCard } from "./product-card";

type Props = {
    limit?: number | null; // undefined/null = afficher tout
    products: Product[];
    canEdit?: boolean;
    canDelete?: boolean;
    showStatusBadge?: boolean;
};

export function ProductsCardsList({
    limit = null,
    products,
    canEdit = false,
    canDelete = false,
    showStatusBadge = false,
}: Props) {
    const { t } = useI18n();

    const productsToShow = limit ? products.slice(0, limit) : products;

    const editProduct = (productId: number) => {
        router.visit(`/admin/products/${productId}/edit`);
    }

    const deleteProduct = (productId: number) => {
        if (confirm(t('Êtes-vous sûr de vouloir supprimer ce produit ?'))) {
            router.visit(`/admin/products/${productId}/destroy`, {
                method: 'delete',
            });
        }
    }

    return (
        <div className="flex gap-10 flex-wrap justify-center max-w-full">
            {productsToShow.map((product) => (
                <ProductCard
                    key={product.id}
                    product={product}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    editProduct={editProduct}
                    deleteProduct={deleteProduct}
                    showStatusBadge={showStatusBadge}
                    className="w-80"
                />
            ))}

        </div>
    );
}