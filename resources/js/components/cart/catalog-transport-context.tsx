import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import {
    getCarrierOverridesStorageKey,
    readCarrierOverrides,
    subscribeToCarrierOverrides,
    writeCarrierOverrides,
    type CarrierOverrides,
} from './cart-carrier-storage';
import { getCarrierOptions, type CartTransportOption } from './cart-shipping';
import type { CartItem } from './cart.context';

type TransportState = {
    overrides: CarrierOverrides;
    options: Record<string, CartTransportOption>;
    attributes: Record<number, Record<string, unknown>>;
    names: Record<number, string>;
    select: (dbId: number, key: string) => void;
};
const CatalogTransportContext = createContext<TransportState>({
    overrides: {},
    options: {},
    attributes: {},
    names: {},
    select: () => {},
});
export const useCatalogTransport = () => useContext(CatalogTransportContext);

export function CatalogTransportProvider({
    items,
    children,
}: {
    items: CartItem[];
    children: ReactNode;
}) {
    const {
        auth,
        cart,
        cart_transport_options,
        cart_transport_attributes,
        cart_transport_db_names,
    } = usePage<
        SharedData & {
            cart_transport_options?: Record<string, CartTransportOption>;
            cart_transport_attributes?: Record<number, Record<string, unknown>>;
            cart_transport_db_names?: Record<number, string>;
        }
    >().props;
    const storageKey = getCarrierOverridesStorageKey(auth?.user?.id, cart?.id);
    const [overrides, setOverrides] = useState<CarrierOverrides>(
        () => readCarrierOverrides(storageKey) ?? {},
    );
    useEffect(() => {
        setOverrides(readCarrierOverrides(storageKey) ?? {});
        return subscribeToCarrierOverrides(storageKey, setOverrides);
    }, [storageKey]);
    const data = useMemo(() => {
        const attributes: TransportState['attributes'] = {};
        const names: TransportState['names'] = {};
        const options: TransportState['options'] = {};
        for (const { product } of items) {
            const id = Number(product.db_products_id ?? product.dbProduct?.id);
            if (product.db_user_attributes)
                attributes[id] = product.db_user_attributes;
            names[id] = product.dbProduct?.name ?? `Base #${id}`;
            const transport = product.db_user_transport;
            if (transport)
                options[`${transport.carrier_id}:${transport.zone_id}`] =
                    transport;
        }
        return {
            attributes: { ...attributes, ...cart_transport_attributes },
            names: { ...names, ...cart_transport_db_names },
            options: { ...options, ...cart_transport_options },
        };
    }, [
        items,
        cart_transport_attributes,
        cart_transport_db_names,
        cart_transport_options,
    ]);
    const select = (dbId: number, key: string) => {
        const transport = data.options[key];
        if (
            !transport ||
            !getCarrierOptions(data.attributes[dbId]).some(
                (option) => `${option.carrierId}:${option.zoneId}` === key,
            )
        )
            return;
        writeCarrierOverrides(storageKey, {
            ...(readCarrierOverrides(storageKey) ?? {}),
            [dbId]: {
                carrierId: transport.carrier_id,
                zoneId: transport.zone_id,
                transport,
            },
        });
    };
    return (
        <CatalogTransportContext.Provider
            value={{ ...data, overrides, select }}
        >
            {children}
        </CatalogTransportContext.Provider>
    );
}
