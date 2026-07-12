<?php

declare(strict_types=1);

namespace App\Domain\Sales\DTO;

final readonly class SalesCalculationSnapshot
{
    public function __construct(
        public string $schemaVersion,
        public string $engineVersion,
        public string $generatedAtUtc,
        public array $payload,
        public string $checksum,
    ) {
    }

    public function toArray(): array
    {
        return [
            'schema_version' => $this->schemaVersion,
            'engine_version' => $this->engineVersion,
            'generated_at_utc' => $this->generatedAtUtc,
            'payload' => $this->payload,
            'checksum' => $this->checksum,
        ];
    }

    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }
}
