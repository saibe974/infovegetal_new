import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import type { BreadcrumbItem, User } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Mail,
    MapPin,
    Pencil,
    Phone,
    ShieldCheck,
    UserRound,
    UsersRound,
} from 'lucide-react';

type Props = {
    user: User;
    parent: { id: number; name: string } | null;
    childrenCount: number;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Users', href: '/users' },
    { title: 'Détail', href: '#' },
];

function roleVariant(
    roleName: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (roleName === 'dev') return 'destructive';
    if (roleName === 'admin') return 'default';
    if (roleName === 'client') return 'secondary';
    return 'outline';
}

export default withAppLayout<Props>(
    breadcrumbs,
    false,
    ({ user, parent, childrenCount }) => {
        const { t, locale } = useI18n();
        const address = [user.address_road, user.address_zip, user.address_town]
            .filter(Boolean)
            .join(', ');
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

                <Card className="overflow-hidden py-0">
                    <div className="h-24 bg-gradient-to-r from-emerald-500/20 via-primary/10 to-transparent" />
                    <CardContent className="relative grid gap-5 px-6 pb-6 sm:grid-cols-[auto_minmax(0,1fr)]">
                        <div className="-mt-12">
                            {user.logo_url ? (
                                <img
                                    src={user.logo_url}
                                    alt={user.name}
                                    className="size-24 rounded-2xl border-4 border-card bg-background object-contain p-1 shadow-md"
                                />
                            ) : (
                                <div className="flex size-24 items-center justify-center rounded-2xl border-4 border-card bg-muted text-3xl font-semibold text-muted-foreground shadow-md">
                                    {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 space-y-3 sm:pt-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-3xl font-bold tracking-tight">
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
                            <p className="text-sm text-muted-foreground">
                                {user.alias || user.ref
                                    ? [user.alias, user.ref]
                                          .filter(Boolean)
                                          .join(' · ')
                                    : t('No additional identifier')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserRound className="size-5 text-primary" />
                                {t('Contact')}
                            </CardTitle>
                            <CardDescription>
                                {t('User contact information')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Mail className="mt-0.5 size-4 text-muted-foreground" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">
                                        {t('Email')}
                                    </p>
                                    <a
                                        href={`mailto:${user.email}`}
                                        className="block truncate text-sm font-medium hover:underline"
                                    >
                                        {user.email || '—'}
                                    </a>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="mt-0.5 size-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('Phone')}
                                    </p>
                                    {user.phone ? (
                                        <a
                                            href={`tel:${user.phone}`}
                                            className="text-sm font-medium hover:underline"
                                        >
                                            {user.phone}
                                        </a>
                                    ) : (
                                        <p className="text-sm">—</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('Address')}
                                    </p>
                                    <p className="text-sm font-medium">
                                        {address || '—'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="size-5 text-primary" />
                                {t('Account')}
                            </CardTitle>
                            <CardDescription>
                                {t('Account status and identifiers')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <Detail label={t('Reference')} value={user.ref} />
                            <Detail label={t('Alias')} value={user.alias} />
                            <Detail
                                label={t('Mailing')}
                                value={user.mailing ? t('Yes') : t('No')}
                            />
                            <div className="flex items-start gap-3 border-t pt-4">
                                <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('Joined')}
                                    </p>
                                    <p className="font-medium">{joined}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UsersRound className="size-5 text-primary" />
                                {t('Hierarchy')}
                            </CardTitle>
                            <CardDescription>
                                {t('Position in the user tree')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {t('Parent')}
                                </p>
                                {parent ? (
                                    <Link
                                        href={`/admin/users/${parent.id}`}
                                        className="font-medium hover:underline"
                                    >
                                        {parent.name}
                                    </Link>
                                ) : (
                                    <p className="font-medium">—</p>
                                )}
                            </div>
                            <Detail
                                label={t('Direct children')}
                                value={String(childrenCount)}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    },
);

function Detail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{value || '—'}</p>
        </div>
    );
}
