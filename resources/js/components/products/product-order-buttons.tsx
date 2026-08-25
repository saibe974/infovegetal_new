import { CartContext } from '@/components/cart/cart.context';
import { useSidebar } from '@/components/ui/sidebar';
import { useI18n } from '@/lib/i18n';
import { addCartonIcon, addEtageIcon, addRollIcon } from '@/lib/icon';
import { resolveProductPrices } from '@/lib/resolve-product-prices';
import { cn, formatCurrency } from '@/lib/utils';
import { Product } from '@/types';
import { useContext } from 'react';

type Props = {
    product: Product;
    className?: string;
};

export function ProductOrderButtons({ product, className }: Props) {
    const { t } = useI18n();
    const { addToCart } = useContext(CartContext);
    const { toggleSidebar, isOpenId } = useSidebar();
    const {
        price,
        price_floor: priceFloor,
        price_roll: priceRoll,
        price_promo: pricePromo,
    } = resolveProductPrices(product);

    const actions = [
        price !== null
            ? {
                  key: 'tray',
                  price,
                  promoPrice: null,
                  quantity: Number(product.cond),
                  icon: addCartonIcon,
                  className: 'bg-brand-tertiary hover:bg-brand-tertiary/90',
                  title: t('Add a tray'),
              }
            : null,
        priceFloor !== null
            ? {
                  key: 'floor',
                  price: priceFloor,
                  promoPrice: null,
                  quantity: Number(product.cond) * Number(product.floor),
                  icon: addEtageIcon,
                  className: 'bg-brand-secondary hover:bg-brand-secondary/90',
                  title: t('Add a floor'),
              }
            : null,
        priceRoll !== null
            ? {
                  key: 'roll',
                  price: priceRoll,
                  promoPrice: pricePromo > 0 ? pricePromo : null,
                  quantity:
                      Number(product.cond) *
                      Number(product.floor) *
                      Number(product.roll),
                  icon: addRollIcon,
                  className: 'bg-brand-main hover:bg-brand-main-hover',
                  title: t('Add a roll'),
              }
            : null,
    ].filter((action): action is NonNullable<typeof action> => action !== null);

    if (actions.length === 0) return null;

    return (
        <div className={cn('gap-1', className)}>
            {actions.map((action) => (
                <button
                    key={action.key}
                    className={cn(
                        'product-order-button flex w-full items-center rounded-md border py-1 text-sm text-white dark:border-accent dark:text-black',
                        action.className,
                    )}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        addToCart(product, action.quantity);
                        if (!isOpenId('right')) toggleSidebar('right');
                    }}
                    title={action.title}
                >
                    <span className="product-order-button__icon flex w-1/3 justify-center">
                        <span className="text-main-purple dark:text-main-green mx-1 size-6">
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: action.icon,
                                }}
                            />
                        </span>
                    </span>
                    <span className="product-order-button__details flex w-1/2 flex-col items-center">
                        {action.promoPrice !== null ? (
                            <>
                                <span className="product-order-button__original-price text-[10px] font-semibold line-through opacity-75">
                                    {formatCurrency(action.price)}
                                </span>
                                <span className="font-semibold text-red-300 dark:text-red-600">
                                    {formatCurrency(action.promoPrice)}
                                </span>
                            </>
                        ) : (
                            <span className="font-semibold">
                                {formatCurrency(action.price)}
                            </span>
                        )}
                        <span className="mr-1 text-xs font-light">
                            X {action.quantity}
                        </span>
                    </span>
                </button>
            ))}
        </div>
    );
}
