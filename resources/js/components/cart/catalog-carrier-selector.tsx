import { getCarrierOptions } from './cart-shipping';
import { useCatalogTransport } from './catalog-transport-context';

export function CatalogCarrierSelector({
    dbId: selectedDbId,
    compact = false,
}: {
    dbId?: number;
    compact?: boolean;
}) {
    const { attributes, names, options, overrides, select } =
        useCatalogTransport();
    return (
        <div
            className={
                compact ? 'min-w-0 flex-1 empty:hidden' : 'space-y-2 px-2'
            }
        >
            {Object.entries(attributes)
                .filter(
                    ([id]) =>
                        selectedDbId === undefined ||
                        Number(id) === selectedDbId,
                )
                .map(([id, attrs]) => {
                    const choices = getCarrierOptions(attrs).filter(
                        (choice) =>
                            options[`${choice.carrierId}:${choice.zoneId}`],
                    );
                    if (choices.length < 2) return null;
                    const dbId = Number(id);
                    const override = overrides[dbId];
                    const preferred =
                        choices.find(
                            (choice) => choice.zoneId === Number(attrs.z),
                        ) ?? choices[0];
                    const selected =
                        (override &&
                            choices.find(
                                (choice) =>
                                    choice.carrierId === override.carrierId &&
                                    choice.zoneId === override.zoneId,
                            )) ||
                        preferred;
                    return (
                        <label
                            key={id}
                            className={
                                compact
                                    ? 'block min-w-0 text-xs'
                                    : 'block space-y-1 text-xs text-muted-foreground'
                            }
                        >
                            <span className={compact ? 'sr-only' : undefined}>
                                {compact
                                    ? 'Transporteur'
                                    : `Transport · ${names[dbId] ?? `Base #${id}`}`}
                            </span>
                            <select
                                aria-label={`Transport · ${names[dbId] ?? `Base #${id}`}`}
                                className={
                                    compact
                                        ? 'h-7 w-full min-w-0 rounded-md border bg-background px-1 text-[11px] text-foreground'
                                        : 'h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground'
                                }
                                value={`${selected.carrierId}:${selected.zoneId}`}
                                onChange={(event) =>
                                    select(dbId, event.target.value)
                                }
                            >
                                {choices.map((choice) => {
                                    const key = `${choice.carrierId}:${choice.zoneId}`;
                                    const option = options[key];
                                    return (
                                        <option key={key} value={key}>
                                            {option.carrier_name ??
                                                `Transporteur #${choice.carrierId}`}{' '}
                                            · {option.zone_name}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    );
                })}
        </div>
    );
}
