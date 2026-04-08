import { type Product } from '@/types';

export const getProductCartImage = (product: Product): string => {
    return (
        product.image_thumb
        ?? product.image_medium
        ?? product.image_original
        ?? product.img_link
        ?? '/images/placeholder.png'
    );
};
