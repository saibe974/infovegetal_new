import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PdfFileIcon } from '@/components/ui/pdf-file-icon';
import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import type { BreadcrumbItem, User } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    FileText,
    ImageIcon,
    Info,
    Link2,
    Mail,
    MapPin,
    Pencil,
    Phone,
    ShieldCheck,
    Smartphone,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';

type UserMeta = {
    id: number;
    key: string;
    title: string | null;
    value: string | null;
    type: string | null;
    sort_order: number;
};
type Props = {
    user: User;
    parent: { id: number; name: string } | null;
    childrenCount: number;
    userMeta: UserMeta[];
    metaKeyOptions: Array<{ value: string; label: string }>;
    metaKeyConfig: Record<string, { input: string; fields: string[] }>;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Users', href: '/users' },
    { title: 'Détail', href: '#' },
];

function roleVariant(
    role: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (role === 'dev') return 'destructive';
    if (role === 'admin') return 'default';
    if (role === 'client') return 'secondary';
    return 'outline';
}

function decodeValue(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try {
        const value: unknown = JSON.parse(raw);
        return value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function fileUrl(meta: UserMeta): string | null {
    const decoded = decodeValue(meta.value);
    const value = typeof decoded?.url === 'string' ? decoded.url : meta.value;
    if (!value) return null;
    return /^(https?:|data:|blob:|\/)/.test(value)
        ? value
        : `/storage/${value}`;
}

function metaLabel(meta: UserMeta, options: Props['metaKeyOptions']): string {
    return (
        meta.title ||
        options.find((option) => option.value === meta.key)?.label ||
        meta.key
    );
}

function MetaIcon({
    meta,
    kind,
    fields,
}: {
    meta: UserMeta;
    kind: string;
    fields: string[];
}) {
    const descriptor = `${meta.key} ${meta.title ?? ''}`.toLocaleLowerCase();
    const isAddress =
        /address|adresse|billing|delivery|livraison|facturation/.test(
            descriptor,
        ) ||
        fields.some((field) =>
            ['road', 'zip', 'town', 'street', 'city'].includes(
                field.toLocaleLowerCase(),
            ),
        );
    const className = 'size-4 shrink-0 text-muted-foreground';

    if (isAddress) return <MapPin className={className} />;
    if (kind === 'mail' || /email|e-mail/.test(descriptor))
        return <Mail className={className} />;
    if (
        kind === 'tel' ||
        kind === 'number tel' ||
        /phone|tel|tél|mobile|portable|gsm/.test(descriptor)
    ) {
        return /mobile|portable|gsm/.test(descriptor) ? (
            <Smartphone className={className} />
        ) : (
            <Phone className={className} />
        );
    }
    if (kind === 'file/pdf' || meta.key === 'pdf')
        return <FileText className={className} />;
    if (kind === 'file/image' || /image|logo|photo/.test(descriptor))
        return <ImageIcon className={className} />;
    if (/url|website|site|link|lien/.test(descriptor))
        return <Link2 className={className} />;
    return <Info className={className} />;
}

function MetaValue({
    meta,
    fields,
    kind,
    onPdfPreview,
}: {
    meta: UserMeta;
    fields: string[];
    kind: string;
    onPdfPreview: (url: string) => void;
}) {
    const decoded = decodeValue(meta.value);

    if (kind === 'file/image') {
        const url = fileUrl(meta);
        return url ? (
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block w-fit"
            >
                <img
                    src={url}
                    alt={meta.title ?? meta.key}
                    className="mt-2 max-h-44 max-w-full rounded-lg border bg-white object-contain p-2"
                />
            </a>
        ) : (
            <span>—</span>
        );
    }

    if (kind === 'file/pdf' || meta.key === 'pdf') {
        const url = fileUrl(meta);
        const name =
            typeof decoded?.file_name === 'string'
                ? decoded.file_name
                : url?.split('/').pop()?.split('?')[0] || 'Voir le PDF';
        return url ? (
            <button
                type="button"
                onClick={() => onPdfPreview(url)}
                className="flex max-w-full min-w-0 items-center gap-2 text-left font-medium text-primary hover:underline"
                title={name}
            >
                <span className="shrink-0">
                    <PdfFileIcon />
                </span>
                <span className="min-w-0 truncate">{name}</span>
            </button>
        ) : (
            <span>—</span>
        );
    }

    if (decoded) {
        const keys = fields.length > 0 ? fields : Object.keys(decoded);
        const parts = keys
            .map((key) => decoded[key])
            .filter((value) => value != null && String(value).trim())
            .map(String);
        return (
            <span className="whitespace-pre-wrap">
                {parts.join(', ') || '—'}
            </span>
        );
    }

    if (!meta.value) return <span>—</span>;
    if (kind === 'mail')
        return (
            <a href={`mailto:${meta.value}`} className="hover:underline">
                {meta.value}
            </a>
        );
    if (kind === 'tel' || kind === 'number tel')
        return (
            <a href={`tel:${meta.value}`} className="hover:underline">
                {meta.value}
            </a>
        );
    return (
        <span className="break-words whitespace-pre-wrap">{meta.value}</span>
    );
}

export default withAppLayout<Props>(
    breadcrumbs,
    false,
    ({ user, parent, userMeta, metaKeyOptions, metaKeyConfig }) => {
        const { t, locale } = useI18n();
        const [pdfViewer, setPdfViewer] = useState<{
            title: string;
            url: string;
        } | null>(null);
        const address = [
            user.address_road,
            [user.address_zip, user.address_town].filter(Boolean).join(' '),
        ]
            .filter(Boolean)
            .join('\n');
        const joined = user.created_at
            ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
                  new Date(user.created_at),
              )
            : '—';

        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <Head title={`${user.name} · ${t('Users')}`} />

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button variant="ghost" asChild>
                        <Link href="/users">
                            <ArrowLeft className="size-4" />
                            {t('Users')}
                        </Link>
                    </Button>
                    {user.abilities?.update && (
                        <Button asChild>
                            <Link href={`/admin/users/${user.id}/edit`}>
                                <Pencil className="size-4" />
                                {t('Edit')}
                            </Link>
                        </Button>
                    )}
                </div>

                <Card>
                    <CardContent className="grid gap-8 px-6 sm:px-8 lg:grid-cols-[160px_minmax(0,1fr)_minmax(18rem,0.9fr)] lg:items-center">
                        <div>
                            {user.logo_url ? (
                                <img
                                    src={user.logo_url}
                                    alt={user.name}
                                    className="size-40 rounded-2xl border-4 border-card bg-white object-contain p-3 shadow-lg"
                                />
                            ) : (
                                <div className="flex size-40 items-center justify-center rounded-2xl border-4 border-card bg-muted text-5xl font-semibold text-muted-foreground shadow-lg">
                                    {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                    {user.name}
                                </h1>
                                <Badge
                                    variant={
                                        user.active ? 'outline' : 'secondary'
                                    }
                                    className={
                                        user.active
                                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                            : undefined
                                    }
                                >
                                    {user.active ? t('Active') : t('Inactive')}
                                </Badge>
                            </div>
                            <p className="text-base text-muted-foreground">
                                {[user.alias, user.ref]
                                    .filter(Boolean)
                                    .join(' · ') ||
                                    t('No additional identifier')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {(user.roles ?? []).map((role) => (
                                    <Badge
                                        key={role.id}
                                        variant={roleVariant(role.name)}
                                    >
                                        {t(role.name)}
                                    </Badge>
                                ))}
                                {(user.roles ?? []).length === 0 && (
                                    <Badge variant="outline">
                                        {t('No role')}
                                    </Badge>
                                )}
                            </div>
                            {parent && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Building2 className="size-4" />
                                    <span>{t('Parent')} :</span>
                                    <Link
                                        href={`/admin/users/${parent.id}`}
                                        className="font-medium text-foreground hover:underline"
                                    >
                                        {parent.name}
                                    </Link>
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                            <h2 className="mb-3 flex items-center gap-2 font-semibold">
                                <UserRound className="size-5 text-primary" />
                                {t('Contact')}
                            </h2>
                            <dl className="divide-y">
                                <IdentityRow
                                    icon={Mail}
                                    label={t('Email')}
                                    value={user.email}
                                    href={
                                        user.email
                                            ? `mailto:${user.email}`
                                            : undefined
                                    }
                                />
                                <IdentityRow
                                    icon={Phone}
                                    label={t('Phone')}
                                    value={user.phone}
                                    href={
                                        user.phone
                                            ? `tel:${user.phone}`
                                            : undefined
                                    }
                                />
                                <IdentityRow
                                    icon={MapPin}
                                    label={t('Address')}
                                    value={address}
                                />
                            </dl>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <IdentitySection icon={ShieldCheck} title={t('Account')}>
                        <IdentityRow label={t('Reference')} value={user.ref} />
                        <IdentityRow label={t('Alias')} value={user.alias} />
                        <IdentityRow
                            label={t('Mailing')}
                            value={user.mailing ? t('Yes') : t('No')}
                        />
                        <IdentityRow
                            icon={CalendarDays}
                            label={t('Joined')}
                            value={joined}
                        />
                    </IdentitySection>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="size-5 text-primary" />
                                Informations complémentaires
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {userMeta.length > 0 ? (
                                <dl>
                                    {userMeta.map((meta) => (
                                        <div
                                            key={meta.id}
                                            className="grid gap-1 border-t py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] sm:items-start"
                                        >
                                            <dt className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <MetaIcon
                                                    meta={meta}
                                                    fields={
                                                        metaKeyConfig[meta.key]
                                                            ?.fields ?? []
                                                    }
                                                    kind={
                                                        meta.type ||
                                                        metaKeyConfig[meta.key]
                                                            ?.input ||
                                                        ''
                                                    }
                                                />
                                                <span>
                                                    {metaLabel(
                                                        meta,
                                                        metaKeyOptions,
                                                    )}
                                                </span>
                                            </dt>
                                            <dd className="min-w-0 text-sm font-medium">
                                                <MetaValue
                                                    meta={meta}
                                                    fields={
                                                        metaKeyConfig[meta.key]
                                                            ?.fields ?? []
                                                    }
                                                    kind={
                                                        meta.type ||
                                                        metaKeyConfig[meta.key]
                                                            ?.input ||
                                                        ''
                                                    }
                                                    onPdfPreview={(url) =>
                                                        setPdfViewer({
                                                            title: metaLabel(
                                                                meta,
                                                                metaKeyOptions,
                                                            ),
                                                            url,
                                                        })
                                                    }
                                                />
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Aucune information complémentaire.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Dialog
                    open={pdfViewer !== null}
                    onOpenChange={(open) => {
                        if (!open) setPdfViewer(null);
                    }}
                >
                    <DialogContent className="h-[90vh] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-6xl">
                        <DialogHeader className="border-b px-6 py-4 pr-12">
                            <DialogTitle
                                className="truncate"
                                title={pdfViewer?.title}
                            >
                                {pdfViewer?.title}
                            </DialogTitle>
                        </DialogHeader>
                        {pdfViewer && (
                            <iframe
                                src={pdfViewer.url}
                                title={pdfViewer.title}
                                className="h-full min-h-0 w-full border-0"
                            />
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        );
    },
);

function IdentitySection({
    icon: Icon,
    title,
    children,
}: {
    icon: typeof UserRound;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="divide-y">{children}</dl>
            </CardContent>
        </Card>
    );
}

function IdentityRow({
    icon: Icon,
    label,
    value,
    href,
}: {
    icon?: typeof UserRound;
    label: string;
    value?: string | null;
    href?: string;
}) {
    const content =
        href && value ? (
            /^(mailto:|tel:)/.test(href) ? (
                <a href={href} className="font-medium hover:underline">
                    {value}
                </a>
            ) : (
                <Link href={href} className="font-medium hover:underline">
                    {value}
                </Link>
            )
        ) : (
            <span className="font-medium whitespace-pre-wrap">
                {value || '—'}
            </span>
        );
    return (
        <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)]">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                {Icon && <Icon className="size-4 shrink-0" />}
                {label}
            </dt>
            <dd className="min-w-0 text-sm break-words">{content}</dd>
        </div>
    );
}
