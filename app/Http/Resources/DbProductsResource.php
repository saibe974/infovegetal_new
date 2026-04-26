<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DbProductsResource extends JsonResource
{
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
            'description' => $this->description,
            'defaults' => $this->defaults,
            'champs' => $this->champs,
            'categories' => $this->categories,
            'traitement' => $this->traitement,
            'header_row_index' => $this->header_row_index,
            'source_delimiter' => $this->source_delimiter,
            'mergins' => $this->mergins,
            'country' => $this->country,
            'mod_liv' => $this->mod_liv,
            'mini' => $this->mini,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
