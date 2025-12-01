import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppearance } from '@/hooks/use-appearance';
import { useI18n } from '@/lib/i18n';
import { ChevronDownIcon, EllipsisVertical, Monitor, Moon, Sun } from 'lucide-react';
import { HTMLAttributes } from 'react';

export default function AppearanceToggleDropdown({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();
    const { t } = useI18n();

    const getCurrentIcon = () => {
        switch (appearance) {
            case 'dark':
                return <Moon className="h-5 w-5" />;
            case 'light':
                return <Sun className="h-5 w-5" />;
            default:
                return <Monitor className="h-5 w-5" />;
        }
    };

    return (
        <div className={className} {...props}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-md"
                    >
                        <span className='lg:hidden'>{getCurrentIcon()}</span>
                        <span className="sr-only">Toggle theme</span>
                        <EllipsisVertical className='hidden lg:block size-6' />
                        <ChevronDownIcon className="size-5 opacity-100 text-muted-foreground lg:hidden" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateAppearance('light')}>
                        <span className="flex items-center gap-2">
                            <Sun className="h-5 w-5" />
                            {t('Light')}
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateAppearance('dark')}>
                        <span className="flex items-center gap-2">
                            <Moon className="h-5 w-5" />
                            {t('Dark')}
                        </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => updateAppearance('system')}
                    >
                        <span className="flex items-center gap-2">
                            <Monitor className="h-5 w-5" />
                            {t('System')}
                        </span>
                    </DropdownMenuItem>
                </DropdownMenuContent>


            </DropdownMenu>
            
            
        </div>
    );
}
