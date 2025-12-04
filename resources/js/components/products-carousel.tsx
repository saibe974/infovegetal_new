import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { type Product } from '@/types';
import Autoplay from "embla-carousel-autoplay";
import { ProductCard } from "./product-card";

type Props = {
    products: Product[];
};

export function ProductsCarousel({ products }: Props) {

    const plugin = React.useRef(
        Autoplay({ delay: 7000, stopOnInteraction: true })
    )

    return (
        <Carousel
            // plugins={[plugin.current]}
            className="w-full md:w-[90%] xl:w-full mx-auto"
        // onMouseEnter={plugin.current.stop}
        // onMouseLeave={plugin.current.reset}
        >
            <CarouselContent className="xl:py-5 xl:px-2">
                {products.map((product) => (
                    <CarouselItem key={product.id} className=" items-center justify-center basis-1/1 md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                        <ProductCard product={product} />
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious className="xl:hidden" />
            <CarouselNext className="xl:hidden" />
        </Carousel>

    )
}
