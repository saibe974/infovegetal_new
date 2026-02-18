import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem, Product, SharedData } from '@/types';
import ProductDetails from '@/components/products/product-details';
import { usePage } from '@inertiajs/react';

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
    const { url } = usePage();
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const showBackLink = params.get('from') === 'search';

    return <ProductDetails product={product} showBackLink={showBackLink} />;
});
