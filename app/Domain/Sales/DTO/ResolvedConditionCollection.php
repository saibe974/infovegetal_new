<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\ConditionType;

final readonly class ResolvedConditionCollection
{
    /**
     * @param list<ResolvedCondition> $items
     */
    public function __construct(public array $items)
    {
        foreach ($items as $item) {
            if (!$item instanceof ResolvedCondition) {
                throw new \InvalidArgumentException('ResolvedConditionCollection expects only ResolvedCondition items.');
            }
        }
    }

    /**
     * @return list<ResolvedCondition>
     */
    public function all(): array
    {
        return $this->items;
    }

    public function first(ConditionType $type, ?ActorType $actorType = null): ?ResolvedCondition
    {
        $filtered = array_values(array_filter(
            $this->items,
            static fn (ResolvedCondition $condition): bool => $condition->type === $type
                && ($actorType === null || $condition->sourceActorType === $actorType)
        ));

        usort(
            $filtered,
            static fn (ResolvedCondition $a, ResolvedCondition $b): int => $a->priority <=> $b->priority
        );

        return $filtered[0] ?? null;
    }

    /**
     * @return list<ResolvedCondition>
     */
    public function ofType(ConditionType $type): array
    {
        return array_values(array_filter(
            $this->items,
            static fn (ResolvedCondition $condition): bool => $condition->type === $type
        ));
    }
}
