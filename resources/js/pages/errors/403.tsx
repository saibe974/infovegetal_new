import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/i18n';
import { home } from '@/routes';
import { store } from '@/routes/login';
import { Form, Head, Link } from '@inertiajs/react';
import { LoaderCircle, ShieldXIcon } from 'lucide-react';

export default function Error403() {
    const { t } = useI18n();

    return (
        <>
            <Head title="403 - Forbidden" />
            <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
                <div className="max-w-md w-full space-y-8">
                    <div className="space-y-4">
                        <ShieldXIcon className="mx-auto h-24 w-24 text-destructive" />
                        <h1 className="text-center text-6xl font-bold text-foreground">403</h1>
                        <h2 className="text-center text-2xl font-semibold text-foreground">
                            {t('Access Forbidden')}
                        </h2>
                        <p className="text-center text-muted-foreground">
                            {t("You don't have permission to access this resource.")}
                        </p>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <Button asChild>
                            <Link href={home().url}>{t('Go Home')}</Link>
                        </Button>
                        <Button variant="outline" onClick={() => window.history.back()}>
                            {t('Go Back')}
                        </Button>
                    </div>

                    <div className="rounded-xl border bg-card p-6">
                        <h3 className="text-lg font-semibold text-foreground">{t('Log in')}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('Sign in with your account to continue.')}
                        </p>

                        <Form
                            action={store().url}
                            method="post"
                            resetOnSuccess={['password']}
                            className="mt-6 flex flex-col gap-4"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">{t('Email or alias')}</Label>
                                        <Input
                                            id="email"
                                            type="text"
                                            name="email"
                                            required
                                            autoComplete="email"
                                            placeholder={t('email@example.com or your-alias')}
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password">{t('Password')}</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            name="password"
                                            required
                                            autoComplete="current-password"
                                            placeholder={t('Password')}
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox id="remember" name="remember" />
                                        <Label htmlFor="remember">{t('Remember me')}</Label>
                                    </div>

                                    <Button type="submit" className="w-full" disabled={processing}>
                                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                                        {t('Log in')}
                                    </Button>
                                </>
                            )}
                        </Form>
                    </div>
                </div>
            </div>
        </>
    );
}
