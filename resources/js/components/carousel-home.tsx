import * as React from "react"
import Autoplay from "embla-carousel-autoplay"
import { Link } from "@inertiajs/react"
import { useI18n } from '@/lib/i18n';

import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { Button } from "./ui/button"
import { AlignRight, ArrowRight, ChevronRight } from "lucide-react"

const images = [
    { src: "/img_carousel/pepin.jpg", alt: "Image 1" },
    { src: "/img_carousel/orchi.jpg", alt: "Image 2" },
    { src: "/img_carousel/infov.jpg", alt: "Image 3" },
]

export function CarouselHome() {
    const { t } = useI18n();
    const plugin = React.useRef(
        Autoplay({ delay: 10000, stopOnInteraction: false })
    )

    const overlays = [
        {
            title: t("$carrousel_01"),
            subtitle: "+100 000 produits",
            button: [
                { label: "Voir le catalogue", href: "/products", primary: true },
            ],
        },
        {
            title: "Des produits de saison",
            subtitle: "Les meilleures variétés de la saison",
            button: [{ label: "Voir les produits", href: "/products", primary: true }],
        },
        {
            title: "L'horticulture connectée à la performance",
            subtitle: "Une plateforme qui répond à vos besoins",
            button: [],
        },
    ]

    return (
        <Carousel
            plugins={[plugin.current]}
            className="w-full max-w-[95%] z-10"
        >
            <CarouselContent className="z-10">
                {images.map((img, index) => (
                    <CarouselItem key={index}>
                        <div className="relative">
                            <Card className="py-0">
                                <CardContent className="h-160 px-0 aspect-square z-10 relative overflow-hidden">
                                    <img
                                        src={img.src}
                                        alt={img.alt}
                                        className="object-cover w-full h-full rounded-xl"
                                    />

                                    {/* Overlay */}
                                    <div className="absolute inset-0 rounded-xl pointer-events-none">
                                        {/* gradient for readability */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent rounded-xl" />
                                        <div className="absolute inset-0 flex items-center justify-start p-6 md:p-10">
                                            <div className="w-full text-center pointer-events-auto p-4 md:p-6 rounded-lg flex flex-col items-center">
                                                <h3 className="text-white text-2xl md:text-4xl font-bold leading-tight">
                                                    {overlays[index].title.charAt(0).toUpperCase() + overlays[index].title.slice(1)}
                                                </h3>
                                                {overlays[index].subtitle && (
                                                    <p className="text-white/90 mt-2 text-sm md:text-lg">
                                                        {overlays[index].subtitle}
                                                    </p>
                                                )}

                                                {overlays[index].button.length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-3">
                                                        <Link
                                                            href={overlays[index].button[0].href}
                                                            className={''}
                                                        >
                                                            <Button className="bg-main-green text-black hover:bg-main-green-hover hover:scale-105 transition-all duration-300">
                                                                {overlays[index].button[0].label}
                                                                <ChevronRight className="size-4" />
                                                            </Button>

                                                        </Link>

                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
        </Carousel>
    )
}
