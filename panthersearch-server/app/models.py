from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class RmpSearchResult(BaseModel):
    id: str
    firstName: str
    lastName: str
    avgRating: float = 0
    avgDifficulty: float = 0
    wouldTakeAgainPercent: int = 0
    numRatings: int = 0
    department: str = ''


class RmpReview(BaseModel):
    id: str
    comment: str = ''
    className: str = ''
    date: str = ''
    grade: str = ''
    thumbsUpTotal: int = 0
    thumbsDownTotal: int = 0
    ratingTags: list[str] = Field(default_factory=list)
    helpfulRating: float = 0
    difficultyRating: float = 0
    attendanceMandatory: bool | None = None


class ProfessorDetail(BaseModel):
    id: str
    firstName: str
    lastName: str
    department: str = ''
    avgRating: float = 0
    avgDifficulty: float = 0
    wouldTakeAgainPercent: int = 0
    numRatings: int = 0
    tags: list[str] = Field(default_factory=list)
    reviews: list[RmpReview] = Field(default_factory=list)


class RedditPost(BaseModel):
    id: str
    title: str
    url: str
    score: int = 0
    subreddit: str
    permalink: str = ''
    createdUtc: int = 0


class GradeDistribution(BaseModel):
    A: int = 0
    B: int = 0
    C: int = 0
    D: int = 0
    F: int = 0
    W: int = 0
    WF: int = 0


class GradeSemester(BaseModel):
    term: str
    instructor: str
    gradeDistribution: GradeDistribution
    totalStudents: int
    avgGPA: float


class ClassSection(BaseModel):
    id: str
    classCode: str
    crn: str
    subject: str
    courseNumber: str
    courseTitle: str = ''
    instructor: str = 'Staff'
    seatsAvailable: int = 0
    maximumEnrollment: int = 0
    enrolled: int = 0
    meetingTimes: str = ''
    creditHours: str = ''
    campusDescription: str = ''
    term: str


class ViewEvent(BaseModel):
    type: Literal['class', 'instructor']
    key: str
    label: str
    href: str
    subtitle: str = ''


class ViewEntry(ViewEvent):
    count: int = 0


class SearchItem(BaseModel):
    id: str
    type: Literal['class', 'instructor']
    title: str
    subtitle: str
    metric: str
    href: str
    meta: dict[str, Any] = Field(default_factory=dict)
