<?php

namespace App\Http\Controllers;

use App\Services\FileImageRuleService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class FileExportImageController extends Controller
{
    public function index(Request $request)
    {
        return response()->json($request->user()->getMedia(FileImageRuleService::COLLECTION)->map(fn (Media $media) => $this->resource($media))->values());
    }

    public function store(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:10240'],
        ]);
        $media = $request->user()->addMediaFromRequest('image')
            ->usingName(pathinfo($request->file('image')->getClientOriginalName(), PATHINFO_FILENAME))
            ->usingFileName(Str::uuid().'.'.$request->file('image')->guessExtension())
            ->toMediaCollection(FileImageRuleService::COLLECTION);

        return response()->json($this->resource($media), 201);
    }

    public function show(Request $request, int $id)
    {
        $media = app(FileImageRuleService::class)->media($id, $request->user());
        abort_unless($media, 404);

        return redirect()->away($media->hasGeneratedConversion('thumb')
            ? $media->getUrl('thumb')
            : $media->getUrl());
    }

    private function resource(Media $media): array
    {
        return [
            'id' => $media->id,
            'name' => $media->name,
            'thumb_url' => $media->getUrl('thumb'),
            'document_url' => $media->getUrl('document'),
        ];
    }
}
