import AppLayout from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import type { BreadcrumbItem, PaginatedCollection, Product } from '@/types';
import { Head, usePage, router, InfiniteScroll } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ProductsTable from '@/components/products/products-table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Media library',
        href: '/admin/media-manager',
    },
];

type MediaPageProps = {
    dbProducts: Array<{ id: number; name: string }>;
    categories: Array<{ id: number; name: string }>;
    collection: PaginatedCollection<Product>;
    q?: string | null;
    filters?: {
        db_products_id?: number | null;
        category_products_id?: number | null;
    };
};

export default function MediaIndex() {
    const { t } = useI18n();
    const { dbProducts = [], categories = [], collection, q, filters } = usePage<MediaPageProps>().props;
    const [activeTab, setActiveTab] = useState<'library' | 'missing'>('library');
    const [search, setSearch] = useState(q ?? '');
    const [selectedDb, setSelectedDb] = useState<string>(filters?.db_products_id ? String(filters.db_products_id) : 'all');
    const [selectedCategory, setSelectedCategory] = useState<string>(filters?.category_products_id ? String(filters.category_products_id) : 'all');

    const applyFilters = () => {
        const params: Record<string, string> = {};
        if (search.trim()) {
            params.q = search.trim();
        }
        if (selectedDb !== 'all') {
            params.db_products_id = selectedDb;
        }
        if (selectedCategory !== 'all') {
            params.category_products_id = selectedCategory;
        }

        router.get('/admin/media-manager', params, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Media library')} />

            <div className="flex min-h-[calc(100svh-9rem)] flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{t('Media library')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('Manage product images and shared media in one place.')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                            <button
                                type="button"
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                                    activeTab === 'library'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => setActiveTab('library')}
                            >
                                {t('Library')}
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                                    activeTab === 'missing'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => setActiveTab('missing')}
                            >
                                {t('Missing images')}
                            </button>
                        </div>
                        <Button asChild variant="outline" className="gap-2">
                            <a href="/admin/media" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                {t('Open in new tab')}
                            </a>
                        </Button>
                    </div>
                </div>

                {activeTab === 'library' ? (
                    <div className="flex-1 min-h-0">
                        <iframe
                            title="Media library"
                            src="/admin/media"
                            className="h-full w-full bg-background"
                            loading="lazy"
                        />
                    </div>
                ) : (
                    <div className="flex-1 min-h-0">
                        <div className="h-full rounded-xl border bg-background p-4 sm:p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-lg font-semibold">
                                        {t('Products missing media')}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {t('List of products with img_link but no media attached.')}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder={t('Search by name, id, or ref')}
                                        className="w-64"
                                    />
                                    <Select value={selectedDb} onValueChange={setSelectedDb}>
                                        <SelectTrigger className="w-48">
                                            <SelectValue placeholder={t('All databases')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t('All databases')}</SelectItem>
                                            {dbProducts.map((db) => (
                                                <SelectItem key={db.id} value={String(db.id)}>
                                                    {db.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                        <SelectTrigger className="w-56">
                                            <SelectValue placeholder={t('All categories')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t('All categories')}</SelectItem>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={String(cat.id)}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={applyFilters}>{t('Apply')}</Button>
                                </div>
                            </div>

                            <div className="mt-6">
                                {collection.data.length === 0 ? (
                                    <div className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                                        {t('No products without media were found.')}
                                    </div>
                                ) : (
                                    <InfiniteScroll data="collection">
                                        <ProductsTable collection={collection} />
                                    </InfiniteScroll>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
