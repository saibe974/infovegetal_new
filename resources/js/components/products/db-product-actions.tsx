import { DialogUpload } from '@/components/dialog-upload';
import ProductsImportTreatment from '@/components/products/import';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import products from '@/routes/products';
import { Link } from '@inertiajs/react';
import { EditIcon, ShellIcon, TrashIcon } from 'lucide-react';

export type DbProductActionsItem = {
    id: number;
    name: string;
    abilities?: {
        update?: boolean;
        manage?: boolean;
        delete?: boolean;
        billing?: boolean;
    } | null;
};

export function DbProductActions({ item }: { item: DbProductActionsItem }) {
    const { t } = useI18n();

    return (
        <div className="flex justify-end gap-2">
            {item.abilities?.manage ? (
                <DialogUpload
                    title={`${t('Update database')} ${item.name}`}
                    uploadUrl="/upload"
                    importProcessUrl={products.admin.import.process.url()}
                    importProcessChunkUrl={products.admin.import.process_chunk.url()}
                    importCancelUrl={products.admin.import.cancel.url()}
                    importProgressUrl={(id) =>
                        products.admin.import.progress.url({ id })
                    }
                    postTreatmentComponent={ProductsImportTreatment}
                    postTreatmentProps={{ dbProductsId: item.id }}
                    finishedLink={{
                        label: t('Missing image'),
                        href: products.images.index.url(),
                    }}
                    buttonLabel=""
                />
            ) : null}
            {item.abilities?.update ? (
                <Button asChild size="icon" variant="outline">
                    <Link href={dbProducts.edit(item.id).url} title={t('Edit')}>
                        <EditIcon size={16} />
                    </Link>
                </Button>
            ) : null}
            {item.abilities?.billing ? (
                <Button asChild size="icon" variant="outline">
                    <Link
                        href={dbProducts.billing(item.id).url}
                        title={t('Billing')}
                    >
                        <ShellIcon size={16} />
                    </Link>
                </Button>
            ) : null}
            {item.abilities?.delete ? (
                <Button asChild size="icon" variant="destructive-outline">
                    <Link
                        href={dbProducts.destroy(item.id).url}
                        method="delete"
                        title={t('Delete')}
                        onBefore={() =>
                            confirm(
                                t(
                                    'Are you sure you want to delete this database?',
                                ),
                            )
                        }
                    >
                        <TrashIcon size={16} />
                    </Link>
                </Button>
            ) : null}
        </div>
    );
}
