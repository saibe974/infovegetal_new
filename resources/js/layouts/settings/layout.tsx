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
import { ArrowLeftCircle, Menu } from 'lucide-react';
import { StickyBar } from '@/components/ui/sticky-bar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

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

    const isMobile = useIsMobile();

    return (
        <div className="p-2 lg:p-4 space-y-6">
            {/* Header */}
            <StickyBar
                className='mb-4 w-full'
                borderBottom={false}
            >
                <div className='flex w-full items-center justify-between'>
                    <div className="flex items-center gap-4 ">
                        <Link href="#"
                            onClick={(e) => { e.preventDefault(); window.history.back(); }}
                            className='hover:text-gray-500 transition-colors duration-200'
                        >
                            <ArrowLeftCircle size={35} />
                        </Link>
                        <div className='flex flex-col'>
                            <h1 className='text-3xl font-bold capitalize'>{editingUser ? editingUser.name : 'Settings'}</h1>
                            <p className="text-gray-500">
                                {editingUser ? `Manage settings for ${editingUser.name}` : 'Manage your profile and account settings'}
                            </p>
                        </div>
                    </div>

                    <div className='md:hidden'>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Menu size={30} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="min-w-80 rounded-lg overflow-visible flex flex-col gap-1"
                                align="end"
                                side={'bottom'}
                            >
                                {sidebarNavItems.map((item, index) => (
                                    <Button
                                        key={`${typeof item.href === 'string' ? item.href : item.href.url}-${index}`}
                                        size="sm"
                                        variant="ghost"
                                        asChild
                                        className={cn(' justify-start w-full', {
                                            'bg-accent':
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <nav className="hidden md:flex gap-2">
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${typeof item.href === 'string' ? item.href : item.href.url}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn(' justify-start', {
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
                </div>
            </StickyBar>

            {/* {editingUser && (
                <div className="mt-2 flex items-center gap-2">
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{`Editing user`}</span>
                    <span className="text-sm text-muted-foreground">{editingUser.email}</span>
                </div>
            )} */}

            <div className="flex-1 w-full max-w-[1200px] mx-auto">
                {children}
            </div>
        </div>
    );
}
