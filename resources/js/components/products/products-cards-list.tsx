import { useI18n } from '@/lib/i18n';
import { type Product } from '@/types';
import { router } from '@inertiajs/react';
import { ProductCard } from './product-card';
import './products-cards-list.css';

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
    };

    const deleteProduct = (productId: number) => {
        if (confirm(t('Êtes-vous sûr de vouloir supprimer ce produit ?'))) {
            router.visit(`/admin/products/${productId}/destroy`, {
                method: 'delete',
            });
        }
    };

    return (
        <div className="products-cards-list flex max-w-full flex-wrap justify-center gap-10">
            {productsToShow.map((product) => (
                <ProductCard
                    key={product.id}
                    product={product}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    editProduct={editProduct}
                    deleteProduct={deleteProduct}
                    showStatusBadge={showStatusBadge}
                    className="w-full"
                    linkClassName="products-cards-list__item"
                />
            ))}
        </div>
    );
}
