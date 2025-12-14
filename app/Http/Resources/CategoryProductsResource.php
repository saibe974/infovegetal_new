<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryProductsResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Assure que la profondeur est calculée si le modèle nested set la fournit
        $depth = $this->depth ?? (method_exists($this->resource, 'getDepth') ? $this->resource->getDepth() : null);
        // Optimise has_children sans charger toute la relation
        $hasChildren = isset($this->lft, $this->rgt) ? (($this->rgt - $this->lft) > 1) : $this->children()->exists();
        return [
            'id' => $this->id,
            'name' => $this->name,
            'parent_id' => $this->parent_id,
            'depth' => $depth,
            'has_children' => (bool) $hasChildren,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
