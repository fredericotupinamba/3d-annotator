import { useI18nContext } from "i18n/i18n-react";
import { useMemo, useState } from "react";
import { ModelType } from "~entity/ModelInformation";
import type { ScalarFieldInfo } from "~entity/ScalarField";
import {
	useAnnotator,
	useModelInformation,
} from "~ui/annotator/contexts/AnnotatorContext";
import { StandardContainer } from "~ui/components/StandardContainer";

interface FilterRow {
	/** stable slot index passed to `PointCloudAnnotator.setFilterSlot` */
	slot: number;
	fieldName: string;
	min: number;
	max: number;
	selectedValues: Set<number>;
}

function createEmptyRow(slot: number): FilterRow {
	return { slot, fieldName: "", min: 0, max: 0, selectedValues: new Set() };
}

export function ScalarFieldSettings() {
	const annotator = useAnnotator();
	const modelInformation = useModelInformation();
	const { LL } = useI18nContext();

	const [collapsed, setCollapsed] = useState(true);
	const [colorField, setColorField] = useState("");
	const [filterRows, setFilterRows] = useState<FilterRow[]>([]);

	const pointCloudAnnotator =
		modelInformation?.modelType === ModelType.POINT_CLOUD &&
		annotator?.isPointCloudAnnotator()
			? annotator
			: null;

	const scalarFields = useMemo(
		() => pointCloudAnnotator?.getScalarFields() ?? [],
		[pointCloudAnnotator]
	);

	if (!pointCloudAnnotator || scalarFields.length === 0) {
		return <></>;
	}

	const maxFilterSlots = pointCloudAnnotator.maxFilterSlots;

	function handleColorFieldChange(name: string) {
		setColorField(name);
		pointCloudAnnotator!.setScalarFieldColoring(name || null);
	}

	function applyRowFilter(
		row: FilterRow,
		field: ScalarFieldInfo | undefined
	) {
		if (!field) {
			pointCloudAnnotator!.setFilterSlot(row.slot, null);
			return;
		}

		if (field.kind === "categorical" && field.uniqueValues) {
			pointCloudAnnotator!.setFilterSlot(row.slot, {
				fieldName: field.name,
				mode: "set",
				selectedValues: Array.from(row.selectedValues),
			});
		} else {
			pointCloudAnnotator!.setFilterSlot(row.slot, {
				fieldName: field.name,
				mode: "range",
				min: row.min,
				max: row.max,
			});
		}
	}

	function addFilterRow() {
		const usedSlots = new Set(filterRows.map((row) => row.slot));
		let slot = 0;
		while (usedSlots.has(slot)) slot++;
		setFilterRows([...filterRows, createEmptyRow(slot)]);
	}

	function removeFilterRow(slot: number) {
		pointCloudAnnotator!.setFilterSlot(slot, null);
		setFilterRows((rows) => rows.filter((row) => row.slot !== slot));
	}

	function handleFieldChange(slot: number, fieldName: string) {
		const field = scalarFields.find((f) => f.name === fieldName);

		setFilterRows((rows) =>
			rows.map((row) => {
				if (row.slot !== slot) return row;

				const newRow: FilterRow =
					field?.kind === "categorical" && field.uniqueValues
						? {
								...row,
								fieldName,
								selectedValues: new Set(field.uniqueValues),
						  }
						: {
								...row,
								fieldName,
								min: field?.min ?? 0,
								max: field?.max ?? 0,
						  };

				applyRowFilter(newRow, field);
				return newRow;
			})
		);
	}

	function handleRangeChange(slot: number, min: number, max: number) {
		setFilterRows((rows) =>
			rows.map((row) => {
				if (row.slot !== slot) return row;
				const newRow = { ...row, min, max };
				applyRowFilter(
					newRow,
					scalarFields.find((f) => f.name === row.fieldName)
				);
				return newRow;
			})
		);
	}

	function handleValueToggle(slot: number, value: number) {
		setFilterRows((rows) =>
			rows.map((row) => {
				if (row.slot !== slot) return row;

				const selectedValues = new Set(row.selectedValues);
				if (selectedValues.has(value)) {
					selectedValues.delete(value);
				} else {
					selectedValues.add(value);
				}

				const newRow = { ...row, selectedValues };
				applyRowFilter(
					newRow,
					scalarFields.find((f) => f.name === row.fieldName)
				);
				return newRow;
			})
		);
	}

	return (
		<StandardContainer styling="select-none p-5 pb-2">
			<h1
				className="-mt-2 mb-2 text-center text-xl hover:cursor-pointer"
				onClick={() => {
					setCollapsed((current) => !current);
				}}
			>
				{LL.SCALAR_FIELDS()}
			</h1>
			<div className={collapsed ? "hidden" : "max-w-xs"}>
				<div className="mt-2">
					<p>{LL.COLOR_BY_SCALAR_FIELD()}</p>
					<select
						className="select select-bordered select-sm mt-1 w-full"
						value={colorField}
						onChange={(event) => {
							handleColorFieldChange(event.target.value);
						}}
					>
						<option value="">{LL.NONE()}</option>
						{scalarFields.map((field) => (
							<option key={field.name} value={field.name}>
								{field.name}
							</option>
						))}
					</select>
				</div>

				<div className="mt-3">
					<p>{LL.FILTER_BY_SCALAR_FIELD()}</p>

					{filterRows.map((row) => {
						const field = scalarFields.find(
							(f) => f.name === row.fieldName
						);

						return (
							<div
								key={row.slot}
								className="mt-2 rounded-xl bg-base-200 p-2"
							>
								<div className="flex items-center gap-2">
									<select
										className="select select-bordered select-sm flex-1"
										value={row.fieldName}
										onChange={(event) => {
											handleFieldChange(
												row.slot,
												event.target.value
											);
										}}
									>
										<option value="">
											{LL.SELECT_FIELD()}
										</option>
										{scalarFields.map((f) => (
											<option key={f.name} value={f.name}>
												{f.name}
											</option>
										))}
									</select>
									<button
										type="button"
										className="btn btn-ghost btn-xs"
										onClick={() => {
											removeFilterRow(row.slot);
										}}
									>
										✕
									</button>
								</div>

								{field?.kind === "categorical" &&
									field.uniqueValues && (
										<div className="mt-2 flex flex-wrap gap-1">
											{field.uniqueValues.map((value) => (
												<label
													key={value}
													className="flex cursor-pointer items-center gap-1 rounded bg-base-300 px-2 py-1 text-sm"
												>
													<input
														type="checkbox"
														className="checkbox checkbox-xs"
														checked={row.selectedValues.has(
															value
														)}
														onChange={() => {
															handleValueToggle(
																row.slot,
																value
															);
														}}
													/>
													{value}
												</label>
											))}
										</div>
									)}

								{field?.kind === "continuous" && (
									<div className="mt-2">
										<div className="flex place-content-between text-sm">
											<span>{row.min.toFixed(2)}</span>
											<span>{row.max.toFixed(2)}</span>
										</div>
										<input
											type="range"
											className="range range-primary range-xs"
											min={field.min}
											max={field.max}
											step={
												(field.max - field.min) / 100 ||
												1
											}
											value={row.min}
											onChange={(event) => {
												handleRangeChange(
													row.slot,
													Math.min(
														+event.target.value,
														row.max
													),
													row.max
												);
											}}
										/>
										<input
											type="range"
											className="range range-primary range-xs"
											min={field.min}
											max={field.max}
											step={
												(field.max - field.min) / 100 ||
												1
											}
											value={row.max}
											onChange={(event) => {
												handleRangeChange(
													row.slot,
													row.min,
													Math.max(
														+event.target.value,
														row.min
													)
												);
											}}
										/>
									</div>
								)}
							</div>
						);
					})}

					<button
						type="button"
						className="btn btn-outline btn-xs mt-2 w-full"
						disabled={filterRows.length >= maxFilterSlots}
						onClick={addFilterRow}
					>
						{LL.ADD_FILTER()}
					</button>
				</div>
			</div>
		</StandardContainer>
	);
}
