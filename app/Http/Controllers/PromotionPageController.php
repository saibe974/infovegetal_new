<?php

namespace App\Http\Controllers;

use App\Domain\Promotions\Enums\PromotionVisibility;
use App\Models\Promotion;
use App\Services\PromotionPageService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class PromotionPageController extends Controller
{
    public function __construct(private readonly PromotionPageService $pages) {}

    public function index(Request $request): Response
    {
        $offers = $this->pages->listedQuery($request->user())->latest('published_at')->orderByDesc('id')->paginate(12)
            ->through(fn (Promotion $promotion) => [
                'title' => $promotion->presentation_title ?: $promotion->title,
                'summary' => Str::limit($promotion->presentation_body ?? '', 180),
                'url' => route('offers.show', $promotion->slug),
                'ends_at' => $promotion->ends_at?->toIso8601String(),
            ]);

        return $this->render($request, 'promotions/offers', ['offers' => $offers], (bool) $request->user());
    }

    public function show(Request $request, Promotion $promotion): Response
    {
        abort_unless($this->pages->canVisit($promotion, $request->user()), 404);

        return $this->render($request, 'promotions/show', [
            'offer' => $this->pages->data($promotion), 'preview' => false, 'manageUrl' => null,
            'noIndex' => $promotion->visibility !== PromotionVisibility::Public,
        ], $promotion->visibility !== PromotionVisibility::Public);
    }

    public function preview(Request $request, Promotion $promotion): Response
    {
        $this->authorize('update', $promotion);

        return $this->render($request, 'promotions/show', [
            'offer' => $this->pages->data($promotion), 'preview' => true,
            'manageUrl' => route('promotions.edit.publication', $promotion), 'noIndex' => true,
        ], true);
    }

    private function render(Request $request, string $component, array $data, bool $noIndex): Response
    {
        $response = Inertia::render($component, $data)->toResponse($request);
        $response->headers->set('Cache-Control', 'private, no-store');
        if ($noIndex) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }
}
