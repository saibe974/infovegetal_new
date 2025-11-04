import * as React from "react"
import Autoplay from "embla-carousel-autoplay"

import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"

const images = [
    { src: "/img_carousel/pepin.jpg", alt: "Image 1" },
    { src: "/img_carousel/orchi.jpg", alt: "Image 2" },
    { src: "/img_carousel/infov.jpg", alt: "Image 3" },
]

export function CarouselHome() {
    const plugin = React.useRef(
        Autoplay({ delay: 7000, stopOnInteraction: false })
    )

    return (
        <Carousel
            plugins={[plugin.current]}
            className="w-full max-w-[95%] "
            // onMouseEnter={plugin.current.stop}
            // onMouseLeave={plugin.current.reset}
        >
            <CarouselContent>
                {Array.from({ length: 3 }).map((_, index) => (
                    <CarouselItem key={index}>
                        <div className="">
                            <Card className="py-0">
                                <CardContent className="h-160 px-0 aspect-square">
                                    <img src={images[index].src} alt={images[index].alt} className="object-cover w-full h-full rounded-xl" />
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
