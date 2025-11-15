import { useI18n } from "@/lib/i18n";
import AppLogoIcon, { AppLogoIconMini } from '@/components/app-logo-icon';

export function AboutSection() {
    const { t } = useI18n();

    return (
        <section className='flex flex-col lg:flex-row gap-5 items-start md:items-center justify-around px-10 lg:px-0 max-w-full'>
            <div className="relative w-40 md:w-60 lg:w-80 overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                <AppLogoIcon className="inset-0 m-auto fill-current text-black/30 dark:text-white/30" />
            </div>

            <div className='flex flex-col gap-8 w-full lg:w-2/5'>
                <h3 className='uppercase text-3xl md:text-5xl font-sans'>
                    {t('infovégétal')}
                </h3>
                <p className="text-lg">
                    {t("InfoVégétal est un concept de vente en ligne s'adressant essentiellement aux professionnels de l'horticulture et de la distribution des plantes.")}
                </p>
                <p className="text-lg">
                    {t("Notre concept a été élaboré pour répondre en toute simplicité aux besoins des professionnels et de leurs clients en privilégiant rapidité, convivialité, performance.")}
                </p>
                <p className="text-lg">
                    {t("InfoVégétal deviendra votre partenaire logistique fiable et efficace dans toutes vos relations commerciales en ne négligeant aucune fonctionnalité. InfoVégétal est le résultat d'une collaboration entre professionnels d'expérience confrontés à des décennies de communication insatisfaite dans ce métier et de jeunes informaticiens aux techniques innovantes.")}
                </p>
                <p className="text-lg">
                    {t("Notre équipe se tient à votre disposition pour satisfaire vos besoins et s'adapter aux particularités de votre entreprise.")}
                </p>
            </div>
        </section>
    );
}