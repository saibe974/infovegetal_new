import { ButtonsActions } from '@/components/buttons-actions';
import { Button } from '@/components/ui/button';
import CountryFlag from '@/components/ui/country-flag';
import { StickyBar } from '@/components/ui/sticky-bar';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import { Link } from '@inertiajs/react';
import { ArrowLeftCircle, InfoIcon, RowsIcon, ShellIcon } from 'lucide-react';
import { ReactNode } from 'react';

export type DatabaseSection = 'info' | 'mapping' | 'billing';

type Props = {
    dbProductId?: number | null;
    country?: string | null;
    title: ReactNode;
    activeSection: DatabaseSection;
    onSectionChange?: (section: 'info' | 'mapping') => void;
    canAccessBilling?: boolean;
    onSave: () => void;
    saving?: boolean;
};

export function DatabaseStickyBar({
    dbProductId,
    country,
    title,
    activeSection,
    onSectionChange,
    canAccessBilling = false,
    onSave,
    saving = false,
}: Props) {
    const { t } = useI18n();
    const sectionUrl = (section: 'info' | 'mapping') => {
        if (!dbProductId) return '#';
        return section === 'info'
            ? dbProducts.edit(dbProductId).url
            : dbProducts.mapping(dbProductId).url;
    };

    const sectionButton = (
        section: 'info' | 'mapping',
        label: string,
        icon: ReactNode,
    ) => {
        const content = (
            <>
                {icon}
                {label}
            </>
        );

        if (onSectionChange) {
            return (
                <Button
                    type="button"
                    variant={activeSection === section ? 'default' : 'outline'}
                    onClick={() => onSectionChange(section)}
                >
                    {content}
                </Button>
            );
        }

        return (
            <Button
                type="button"
                variant={activeSection === section ? 'default' : 'outline'}
                asChild
            >
                <Link href={sectionUrl(section)}>{content}</Link>
            </Button>
        );
    };

    return (
        <StickyBar className="mb-4 w-full">
            <div className="flex min-w-0 items-center gap-4">
                <Link
                    href="#"
                    onClick={(event) => {
                        event.preventDefault();
                        window.history.back();
                    }}
                    className="shrink-0 transition-colors duration-200 hover:text-gray-500"
                    aria-label={t('Back')}
                >
                    <ArrowLeftCircle size={35} />
                </Link>
                <CountryFlag
                    countryCode={country ?? ''}
                    title={country ?? ''}
                    className="w-4 shrink-0"
                />
                <div className="min-w-0 text-3xl font-bold capitalize">
                    {title}
                </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
                {sectionButton(
                    'info',
                    t('Info'),
                    <InfoIcon size={20} className="mr-2" />,
                )}
                {sectionButton(
                    'mapping',
                    t('Mapping'),
                    <RowsIcon size={20} className="mr-2" />,
                )}
                {dbProductId && canAccessBilling ? (
                    <Button
                        type="button"
                        variant={
                            activeSection === 'billing' ? 'default' : 'outline'
                        }
                        asChild
                    >
                        <Link href={dbProducts.billing(dbProductId).url}>
                            <ShellIcon size={20} className="mr-2" />
                            {t('Billing')}
                        </Link>
                    </Button>
                ) : null}
                <ButtonsActions
                    save={onSave}
                    saving={saving}
                    className="ml-0"
                />
            </div>
        </StickyBar>
    );
}
