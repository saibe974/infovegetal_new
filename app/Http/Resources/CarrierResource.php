<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CarrierResource extends JsonResource
{
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'country' => $this->country,
            'days' => $this->days,
            'minimum_delay_hours' => (int) ($this->minimum_delay_hours ?? 24),
            'order_cutoff_time' => substr((string) ($this->order_cutoff_time ?? '12:00'), 0, 5),
            'minimum' => $this->minimum,
            'taxgo' => $this->taxgo,
            'zones_count' => $this->whenCounted('zones'),
            'zones' => CarrierZoneResource::collection($this->whenLoaded('zones')),
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
