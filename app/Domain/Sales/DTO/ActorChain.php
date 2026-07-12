<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class ActorChain
{
    public function __construct(
        public int $databaseOwnerId,
        public int $billingUserId,
        public ?int $sellerId,
    ) {
    }
}
