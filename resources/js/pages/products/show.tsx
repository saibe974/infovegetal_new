import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem, Product } from '@/types';
import ProductDetails from '@/components/products/product-details';

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
    const showBackLink = true;

    return (
        <>
            <ProductDetails product={product} showBackLink={showBackLink} />
        </>
    );
});
