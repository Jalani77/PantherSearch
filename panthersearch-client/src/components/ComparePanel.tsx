import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CatalogItem, Section } from '../types';

type ComparePanelProps = {
  classA: CatalogItem;
  classB: CatalogItem;
};

const winnerClass = (a: number, b: number, left = 'text-[#1B3BFF]', right = 'text-[#6C2DFF]') => ({
  a: a >= b ? left : '',
  b: b > a ? right : '',
});

function CompareSections({ courseCode, sections }: { courseCode: string; sections: Section[] }) {
  const openPawsRegistration = (termCode: string, crn: string) => {
    window.open(
      `https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb/classRegistration/classRegistration?term=${encodeURIComponent(termCode)}&crn=${encodeURIComponent(crn)}`,
      '_blank',
      'noopener',
    );
  };

  if (!sections.length) {
    return <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-xs text-[#6B7280]">No live sections loaded for {courseCode}.</div>;
  }

  return (
    <div className="space-y-2">
      {sections.slice(0, 2).map((section) => (
        <div key={section.id} className="rounded-lg border border-[#E5E7EB] bg-white p-3">
          <div className="text-xs font-semibold text-[#111827]">
            CRN {section.crn} • {section.days} {section.startTime === 'Async' ? '' : `${section.startTime}-${section.endTime}`}
          </div>
          <div className="mt-1 text-xs text-[#6B7280]">{section.instructorName || 'Staff'}</div>
          <button type="button" onClick={() => openPawsRegistration(section.termCode || section.semester, section.crn)} className="btn-black mt-2 px-3 py-1.5 text-xs">
            Register in PAWS
          </button>
          <div className="mt-2 text-[11px] leading-4 text-[#6B7280]">After login, go to Registration and enter CRN {section.crn} for {section.termLabel || section.semester}.</div>
        </div>
      ))}
    </div>
  );
}

export default function ComparePanel({ classA, classB }: ComparePanelProps) {
  const openWinner = winnerClass(classA.openSeats, classB.openSeats);
  const studentsWinner = winnerClass(classA.totalStudents, classB.totalStudents);
  const sectionsWinner = winnerClass(classA.sections, classB.sections);
  const [sectionsA, setSectionsA] = useState<Section[]>([]);
  const [sectionsB, setSectionsB] = useState<Section[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [aSeats, bSeats] = await Promise.all([api.getSeats(classA.code).catch(() => null), api.getSeats(classB.code).catch(() => null)]);
        if (cancelled) return;
        setSectionsA(aSeats?.sections || []);
        setSectionsB(bSeats?.sections || []);
      } catch (error) {
        console.error('Compare panel seat load failed', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [classA.code, classB.code]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card space-y-3 bg-[#F8F8FD] p-5">
          <div className="text-2xl font-bold text-[#111827]">{classA.code}</div>
          <div className="text-sm text-[#6B7280]">{classA.name}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-[#E5E7EB] p-3">
              <div className="text-caption">Open seats</div>
              <div className="mt-1 text-sm font-semibold text-[#1B3BFF]">{classA.openSeats}</div>
            </div>
            <div className="rounded-md border border-[#E5E7EB] p-3">
              <div className="text-caption">Sections</div>
              <div className="mt-1 text-sm font-semibold text-[#6C2DFF]">{classA.sections}</div>
            </div>
          </div>
          <CompareSections courseCode={classA.code} sections={sectionsA} />
        </div>

        <div className="surface-card space-y-3 bg-[#F8F8FD] p-5">
          <div className="text-2xl font-bold text-[#111827]">{classB.code}</div>
          <div className="text-sm text-[#6B7280]">{classB.name}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-[#E5E7EB] p-3">
              <div className="text-caption">Open seats</div>
              <div className="mt-1 text-sm font-semibold text-[#1B3BFF]">{classB.openSeats}</div>
            </div>
            <div className="rounded-md border border-[#E5E7EB] p-3">
              <div className="text-caption">Sections</div>
              <div className="mt-1 text-sm font-semibold text-[#6C2DFF]">{classB.sections}</div>
            </div>
          </div>
          <CompareSections courseCode={classB.code} sections={sectionsB} />
        </div>
      </div>

      <div className="surface-card p-4">
        <div className="section-label mb-3">Comparison Snapshot</div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Open Seats</div>
            <div className={`mt-1 text-sm font-semibold ${openWinner.a}`}>
              {classA.code}: {classA.openSeats}
            </div>
            <div className={`text-sm font-semibold ${openWinner.b}`}>
              {classB.code}: {classB.openSeats}
            </div>
          </div>
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Sections</div>
            <div className={`mt-1 text-sm font-semibold ${sectionsWinner.a}`}>
              {classA.code}: {classA.sections}
            </div>
            <div className={`text-sm font-semibold ${sectionsWinner.b}`}>
              {classB.code}: {classB.sections}
            </div>
          </div>
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Total students</div>
            <div className={`mt-1 text-sm font-semibold ${studentsWinner.a}`}>
              {classA.code}: {classA.totalStudents}
            </div>
            <div className={`text-sm font-semibold ${studentsWinner.b}`}>
              {classB.code}: {classB.totalStudents}
            </div>
          </div>
          <div className="rounded-md border border-[#E5E7EB] p-3">
            <div className="text-caption">Terms with seats</div>
            <div className="mt-1 text-sm font-semibold">
              {classA.code}: {classA.termCount}
            </div>
            <div className="text-sm font-semibold">
              {classB.code}: {classB.termCount}
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="section-label mb-2">Which Should I Take?</div>
        <p className="text-sm leading-7 text-[#111111]">
          {classA.code} currently has {classA.openSeats >= classB.openSeats ? 'more' : 'fewer'} open seats ({classA.openSeats} vs {classB.openSeats}) and{' '}
          {classA.sections >= classB.sections ? 'more' : 'fewer'} available sections ({classA.sections} vs {classB.sections}). If you want broader scheduling flexibility right now, pick the class with higher open-seat and section counts.
        </p>
      </div>
    </div>
  );
}

