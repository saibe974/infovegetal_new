import { type Product } from '@/types';
import { resolveImageUrl } from '@/lib/resolve-image-url';

export const getProductCartImage = (product: Product): string => {
    return resolveImageUrl(
        product.image_thumb
        ?? product.image_medium
        ?? product.image_original
        ?? product.img_link
        ?? '/images/placeholder.png'
    );
};
