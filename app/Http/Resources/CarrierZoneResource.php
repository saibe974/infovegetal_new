<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CarrierZoneResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $tariffs = [];
        foreach (($this->tariffs ?? []) as $key => $value) {
            if ($key === 'mini') {
                $tariffs['mini'] = $value;
                continue;
            }

            $stringKey = (string) $key;
            if (!str_starts_with($stringKey, 'roll:')) {
                $stringKey = 'roll:' . $stringKey;
            }

            $tariffs[$stringKey] = $value;
        }

        return [
            'id' => $this->id,
            'carrier_id' => $this->carrier_id,
            'name' => $this->name,
            'tariffs' => $tariffs,
            'created_at' => $this->created_at?->toDateTimeString(),
            'updated_at' => $this->updated_at?->toDateTimeString(),
        ];
    }
}
