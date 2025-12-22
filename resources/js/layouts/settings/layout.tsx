import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editPassword } from '@/routes/password';
import { edit } from '@/routes/users';
import { show } from '@/routes/two-factor';
import { type NavItem, type SharedData, type User } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';
import { isAdmin } from '@/lib/roles';

// sidebarNavItems are built inside the component to access `auth` for user-specific routes

export default function SettingsLayout({ children }: PropsWithChildren) {
    const pageProps = usePage<SharedData & { editingUser?: User }>().props;
    const { auth, editingUser } = pageProps;

    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    const userId = editingUser ? editingUser.id : auth.user!.id;

    const sidebarNavItems: NavItem[] = [
        {
            title: 'Profile',
            href: edit(userId),
            icon: null,
        },
    ];

    if (userId == auth.user!.id) {
        sidebarNavItems.push({
            title: 'Password',
            href: editPassword(userId),
            icon: null,
        },
            {
                title: 'Two-Factor Auth',
                href: show(userId),
                icon: null,
            },
            {
                title: 'Appearance',
                href: editAppearance(userId),
                icon: null,
            }
        );

    }
    const currentPath = window.location.pathname;

    // Ajout de lien si l'utilisateur est admin
    if (isAdmin(auth.user)) {
        sidebarNavItems.push({
            title: 'Database access',
            href: editingUser ? `/admin/users/${editingUser.id}/db` : '#',
            icon: null,
        });

        // sidebarNavItems.push({
        //     title: 'Margin settings',
        //     href: '#',
        //     icon: null,
        // });
    }

    return (
        <div className="px-4 py-6">
            <Heading
                title={editingUser ? editingUser.name : 'Settings'}
                description={editingUser ? `Manage settings for ${editingUser.name}` : 'Manage your profile and account settings'}
            />

            {/* {editingUser && (
                <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{`Editing user`}</span>
                    <span className="text-sm text-muted-foreground">{editingUser.email}</span>
                </div>
            )} */}

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav className="flex flex-col space-y-1 space-x-0">
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${typeof item.href === 'string' ? item.href : item.href.url}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted':
                                        currentPath ===
                                        (typeof item.href === 'string'
                                            ? item.href
                                            : item.href.url),
                                })}
                            >
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1 md:max-w-2xl">
                    <section className="max-w-xl space-y-12">
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
