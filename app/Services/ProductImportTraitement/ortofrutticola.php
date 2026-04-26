<?php
/*----------------------------------*\

	traitement spécifique DB ortofrutticola

\*----------------------------------*/

function importProducts_ortofrutticola($params = array(), $resolve)
{
	$params = array_merge([
		'mapped' => [],
		'defaultsMap' => [],
		'processed' => 0,
		'errors' => 0,
		'reportHandle' => null,
		'updateProgress' => function () {},
		'currentIndex' => 0,
		'validCategoryIds' => [],
		'defaultsMapCategories' => [],
		'db_products_id' => null,
	], $params);

	extract($params);

	static $currentCategoryLabel = null;

	$parsePrice = function ($value): ?float {
		if ($value === null) {
			return null;
		}

		$normalized = str_replace([',', ' ', 'EUR', '€', "\xc2\xa0"], ['.', '', '', '', ''], (string) $value);

		return is_numeric($normalized) ? (float) $normalized : null;
	};

	$parseInteger = function ($value): ?int {
		if ($value === null) {
			return null;
		}

		$digits = preg_replace('/[^0-9]/', '', (string) $value);

		return $digits !== '' ? (int) $digits : null;
	};

	$slugify = function (?string $value): string {
		return (new \Symfony\Component\String\Slugger\AsciiSlugger())
			->slug((string) ($value ?? ''))
			->lower()
			->toString();
	};

	$resolveCategoryId = function (?string $label) use ($defaultsMapCategories, $validCategoryIds, $slugify): int {
		$slug = $slugify($label);
		$categoryId = isset($defaultsMapCategories[$slug]) ? (int) $defaultsMapCategories[$slug] : 51;

		if (!in_array($categoryId, $validCategoryIds, true)) {
			return 51;
		}

		return $categoryId;
	};

	$normalizeText = function (?string $value): ?string {
		if ($value === null) {
			return null;
		}

		$value = trim(preg_replace('/\s+/', ' ', $value));

		return $value === '' ? null : $value;
	};

	$extractDescriptionData = function (?string $rawDescription) use ($normalizeText): array {
		$description = $normalizeText($rawDescription);

		if ($description === null) {
			return [
				'name' => null,
				'description' => null,
				'pot' => null,
				'height' => null,
			];
		}

		$working = mb_strtolower($description);
		$working = str_replace(['pot plastic', 'pot pl.', 'pl.'], 'pot plastique', $working);
		$working = str_replace(['plast.', 'coul.'], ['plastique', 'couleur'], $working);
		$working = str_replace(['tc'], ['terre cuite'], $working);
		$working = str_replace(['etoile de noel'], ['poinsetia'], $working);
		$working = preg_replace('/\s+/', ' ', $working);

		$name = $working;
		$pot = null;
		$remark = null;
		$height = null;

		$regLatin = '([^Ø]+)';
		$regPot = '\s*Ø\s*(\d+(?:\.\d+)?)';
		$regRem = '(?:\s+([^\s-]+(?:\s+[^\s]+)*))?';
		$regHaut = '(?:\s*h\.?\s*(\d+(?:[\/-]\d+)?))?';
		$regex = '/^' . $regLatin . $regPot . $regRem . $regHaut . '$/iu';

		if (preg_match($regex, $working, $matches)) {
			$name = isset($matches[1]) ? trim($matches[1]) : $name;
			$pot = isset($matches[2]) && is_numeric($matches[2]) ? (int) round((float) $matches[2]) : null;
			$remark = isset($matches[3]) ? trim($matches[3]) : null;
			$height = isset($matches[4]) ? str_replace('/', '-', $matches[4]) : null;
		}

		if ($pot === null && str_contains($working, 'Ø')) {
			if (preg_match('/Ø\s*(\d+(?:\.\d+)?)(?:\s*(.*))?$/iu', $working, $matches)) {
				$pot = is_numeric($matches[1] ?? null) ? (int) round((float) $matches[1]) : null;
				$remark = isset($matches[2]) ? trim((string) $matches[2]) : $remark;
				if ($remark !== null) {
					$remark = preg_replace('/\/\d+/', '', $remark);
					$remark = trim($remark);
				}
			}

			$name = trim((string) explode('Ø', $working)[0]);
		}

		if ($height === null && $remark !== null) {
			if (preg_match('/h\.?\s*(\d+)(?:\/(\d+))?(?:\s*cm\.?)?/iu', $remark, $matches)) {
				$height = isset($matches[2]) ? $matches[1] . '-' . $matches[2] : $matches[1];
				$remark = trim((string) preg_replace('/h\.?\s*\d+(?:\/\d+)?(?:\s*cm\.?)?/iu', '', $remark));
			}
		}

		if ($height === null && $remark !== null) {
			if (preg_match('/(\d+(?:-\d+)?)/', $remark, $matches)) {
				$height = $matches[1];
			}
		}

		if ($remark !== null) {
			$remark = str_replace(['-', '()'], '', $remark);
			$remark = trim((string) preg_replace('/\s+/', ' ', $remark));
		}

		return [
			'name' => $normalizeText($name),
			'description' => $normalizeText($remark),
			'pot' => $pot,
			'height' => $normalizeText($height),
		];
	};

	$ref = trim((string) ($resolve($mapped, $defaultsMap, 'ref') ?? $resolve($mapped, $defaultsMap, 'sku') ?? ''));
	$ean13 = trim((string) ($resolve($mapped, $defaultsMap, 'ean13') ?? ''));
	$rawDescription = $normalizeText((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
	$price = $parsePrice($resolve($mapped, $defaultsMap, 'price'));
	$priceFloor = $parsePrice($resolve($mapped, $defaultsMap, 'price_floor'));
	$pcsPerFloor = $parseInteger($resolve($mapped, $defaultsMap, 'floor'));
	$pcsPerRoll = $parseInteger($resolve($mapped, $defaultsMap, 'roll'));

	$isBlockCategoryRow = $ref === ''
		&& $ean13 === ''
		&& $rawDescription !== null
		&& $price === null
		&& $priceFloor === null;

	if ($isBlockCategoryRow) {
		$currentCategoryLabel = $rawDescription;
		return ['skip' => true];
	}

	if ($ref === '' && $ean13 === '' && $rawDescription === null) {
		return ['skip' => true];
	}

	if ($ref === '' || $ean13 === '') {
		return ['error' => 'Missing ean13 or ref', 'row' => $mapped];
	}

	$parsed = $extractDescriptionData($rawDescription);
	$pot = $parsed['pot'];
	$name = $parsed['name'];
	$description = $parsed['description'];
	$height = $parsed['height'];

	if ($name === null) {
		return ['error' => 'Missing parsed name', 'row' => $mapped];
	}

	$cond = null;
	if ($pot !== null && $pcsPerFloor !== null) {
		$cond = match ($pot) {
			10 => match ($pcsPerFloor) {
				60 => 15,
				66 => 11,
				default => null,
			},
			12 => match ($pcsPerFloor) {
				32, 40 => 8,
				44 => 11,
				50 => 10,
				default => null,
			},
			14 => match ($pcsPerFloor) {
				36 => 6,
				40 => 8,
				default => null,
			},
			default => null,
		};
	}

	$sourceFloor = $pcsPerFloor !== null && $pcsPerFloor > 0 ? $pcsPerFloor : 1;
	$sourceRoll = $pcsPerRoll !== null && $pcsPerRoll > 0 ? $pcsPerRoll : 1;

	if ($cond === null || $cond <= 0) {
		$cond = 1;
	}

	$floor = max((int) floor($sourceFloor / $cond), 1);
	$roll = max((int) floor($sourceRoll / ($sourceFloor)), 1);

	$categoryId = $resolveCategoryId($currentCategoryLabel);

	$imgLink = 'https://ortofrutticola.org/images/articles/' . $ref . '.jpg';
	$sku = $ean13 . '_' . $ref;
	$activeVal = $resolve($mapped, $defaultsMap, 'active');
	$active = isset($activeVal) ? (int) $activeVal : 1;

	return [
		'sku' => $sku,
		'name' => $name,
		'description' => $description,
		'img_link' => $imgLink,
		'price' => $price ?? 0.0,
		'active' => $active,
		'category_products_id' => $categoryId,
		'db_products_id' => isset($db_products_id) && is_numeric($db_products_id) ? (int) $db_products_id : null,
		'ref' => $ref,
		'ean13' => $ean13,
		'pot' => $pot,
		'height' => $height,
		'price_floor' => $priceFloor,
		'price_roll' => $priceFloor,
		'price_promo' => null,
		'producer_id' => null,
		'tva_id' => null,
		'cond' => $cond,
		'floor' => $floor,
		'roll' => $roll,
	];
}
