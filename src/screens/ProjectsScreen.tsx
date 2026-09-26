import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bar,
  Btn,
  Card,
  CheckCircle,
  Chip,
  EmptyState,
  IconBadge,
  Label,
  PriorityBadge,
  SectionHeader,
} from '../components/ui';
import { dueLabel, fmtDateShort } from '../lib/dates';
import { getProjectStats, getProjectDeadlinePressure } from '../lib/engine';
import { useStore, useUI } from '../lib/store';
import type { Project, ProjectStatus, Task } from '../types';
import { alpha, C, R, S, shadow } from '../theme';

export function ProjectsScreen() {
  const { state, toggleTask, archiveProject, updateProject } = useStore();
  const { openProject, openTask, openFocusModal, openBreakdownModal } = useUI();
  const [filter, setFilter] = useState<'active' | 'all' | 'archived'>('active');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const projects = state?.projects ?? [];
  const tasks = state?.tasks ?? [];

  const filteredProjects = useMemo(() => {
    if (filter === 'active') {
      return projects.filter((p) => p.status === 'active');
    }
    if (filter === 'archived') {
      return projects.filter((p) => p.status === 'archived');
    }
    return projects;
  }, [projects, filter]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const selectedStats = useMemo(() => {
    if (!selectedProject) return null;
    return getProjectStats(selectedProject, tasks);
  }, [selectedProject, tasks]);

  const projectTasks = useMemo(() => {
    if (!selectedProjectId) return { incomplete: [], completed: [] };
    const pTasks = tasks.filter((t) => t.projectId === selectedProjectId);
    return {
      incomplete: pTasks.filter((t) => !t.done),
      completed: pTasks.filter((t) => t.done),
    };
  }, [tasks, selectedProjectId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: S.l, paddingTop: S.m, paddingBottom: S.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '800' }}>Projects</Text>
            <Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }}>
              High-level containers for focused execution
            </Text>
          </View>
          <Btn
            title="+ Project"
            compact
            icon="add"
            onPress={() => openProject()}
          />
        </View>

        {/* Filter Pills */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: C.surface2,
            borderRadius: R.pill,
            padding: 4,
            marginTop: S.m,
          }}
        >
          {(['active', 'all', 'archived'] as const).map((tab) => {
            const active = filter === tab;
            const count =
              tab === 'active'
                ? projects.filter((p) => p.status === 'active').length
                : tab === 'archived'
                ? projects.filter((p) => p.status === 'archived').length
                : projects.length;

            return (
              <Pressable
                key={tab}
                onPress={() => setFilter(tab)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 7,
                  borderRadius: R.pill,
                  backgroundColor: active ? C.amber : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: active ? '#1A1206' : C.sub,
                    fontWeight: '800',
                    fontSize: 12.5,
                    textTransform: 'capitalize',
                  }}
                >
                  {tab} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Projects List */}
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: S.l, paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No projects found"
            sub={
              filter === 'archived'
                ? 'No archived projects yet.'
                : 'Create your first project to organize related tasks and track progress.'
            }
            actionText={filter === 'active' ? '+ Create Project' : undefined}
            onAction={filter === 'active' ? () => openProject() : undefined}
          />
        }
        renderItem={({ item, index }) => {
          const stats = getProjectStats(item, tasks);
          const col = item.color || C.blue;

          return (
            <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
              <Card
                onPress={() => setSelectedProjectId(item.id)}
                style={{
                  marginBottom: S.m,
                  borderColor: alpha(col, 0.35),
                  ...shadow,
                }}
              >
                {/* Project Card Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconBadge
                    icon={(item.icon as any) || 'folder-outline'}
                    color={col}
                    size={38}
                    iconSize={18}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '800' }}>
                      {item.name}
                    </Text>
                    {item.description ? (
                      <Text style={{ color: C.sub, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Chip color={item.status === 'completed' ? C.green : item.status === 'archived' ? C.faint : col}>
                    <Text
                      style={{
                        color: item.status === 'completed' ? C.green : item.status === 'archived' ? C.faint : col,
                        fontSize: 10.5,
                        fontWeight: '800',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.status}
                    </Text>
                  </Chip>
                </View>

                {/* Progress Bar & Percentage */}
                <View style={{ marginTop: S.m }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '700' }}>
                      {stats.completed} / {stats.total} tasks completed
                    </Text>
                    <Text style={{ color: col, fontSize: 12, fontWeight: '800' }}>
                      {stats.pct}%
                    </Text>
                  </View>
                  <Bar pct={stats.pct} color={col} height={7} />
                </View>

                {/* Footer Info: Deadline & Status */}
                {(() => {
                  const pressure = getProjectDeadlinePressure(item, tasks);
                  return (
                    <>
                      {item.deadline && pressure ? (
                        <View style={{ marginTop: 8, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons
                            name={pressure.isPressureHigh ? 'warning' : 'information-circle-outline'}
                            size={13}
                            color={pressure.isPressureHigh ? C.amber : C.faint}
                          />
                          <Text
                            style={{
                              color: pressure.isPressureHigh ? C.amber : C.faint,
                              fontSize: 11,
                              fontWeight: '600',
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {pressure.statusText}
                          </Text>
                        </View>
                      ) : null}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: S.m,
                          paddingTop: S.s,
                          borderTopWidth: 1,
                          borderTopColor: C.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="time-outline" size={14} color={C.faint} />
                          <Text style={{ color: C.sub, fontSize: 12 }}>
                            {item.deadline ? dueLabel(item.deadline) : 'No deadline'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700' }}>Open Details</Text>
                          <Ionicons name="chevron-forward" size={14} color={C.amber} />
                        </View>
                      </View>
                    </>
                  );
                })()}
              </Card>
            </Animated.View>
          );
        }}
      />

      {/* Project Detail Modal */}
      {selectedProject && selectedStats ? (
        <Modal
          visible={!!selectedProject}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedProjectId(null)}
        >
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              {/* Modal Navigation Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: S.l,
                  paddingVertical: S.m,
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                }}
              >
                <Pressable
                  onPress={() => setSelectedProjectId(null)}
                  hitSlop={10}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="arrow-back" size={20} color={C.text} />
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>Projects</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => {
                    openProject(selectedProject);
                  }}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: R.pill,
                    backgroundColor: C.surface2,
                    borderWidth: 1,
                    borderColor: C.border2,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => setSelectedProjectId(null)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={C.sub} />
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: S.l, paddingBottom: 80 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* Project Header Card */}
                <Card style={{ borderColor: alpha(selectedProject.color || C.blue, 0.4) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <IconBadge
                      icon={(selectedProject.icon as any) || 'folder-outline'}
                      color={selectedProject.color || C.blue}
                      size={44}
                      iconSize={22}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>
                        {selectedProject.name}
                      </Text>
                      {selectedProject.deadline ? (
                        <Text style={{ color: C.amber, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                          Due: {dueLabel(selectedProject.deadline)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {selectedProject.description ? (
                    <Text style={{ color: C.sub, fontSize: 13.5, lineHeight: 20, marginTop: S.m }}>
                      {selectedProject.description}
                    </Text>
                  ) : null}

                  {/* Progress section */}
                  <View style={{ marginTop: S.l }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: C.faint, fontSize: 12, fontWeight: '700' }}>
                        Overall Progress ({selectedStats.completed}/{selectedStats.total} tasks)
                      </Text>
                      <Text style={{ color: selectedProject.color || C.blue, fontSize: 13, fontWeight: '800' }}>
                        {selectedStats.pct}%
                      </Text>
                    </View>
                    <Bar pct={selectedStats.pct} color={selectedProject.color || C.blue} height={8} />
                  </View>
                </Card>

                {/* Deadline Intelligence Card */}
                {(() => {
                  const dp = selectedProject.deadline ? getProjectDeadlinePressure(selectedProject, tasks) : null;
                  if (!dp) return null;
                  const fmtM = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ''}`.trim());
                  return (
                    <Card style={{ marginTop: S.m, borderColor: alpha(dp.isPressureHigh ? C.amber : C.teal, 0.3) }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Ionicons
                          name="speedometer-outline"
                          size={16}
                          color={dp.isPressureHigh ? C.amber : C.teal}
                        />
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>
                          DEADLINE INTELLIGENCE
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
                        <View>
                          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>REMAINING</Text>
                          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                            {dp.remainingTasksCount} {dp.remainingTasksCount === 1 ? 'task' : 'tasks'}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>EST. WORK</Text>
                          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                            ~{fmtM(dp.estimatedRemainingMinutes)}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: C.faint, fontSize: 11, fontWeight: '700' }}>USABLE TIME</Text>
                          <Text style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 2 }}>
                            ~{fmtM(dp.availableUsableMinutes)}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          marginTop: 8,
                          paddingTop: 8,
                          borderTopWidth: 1,
                          borderTopColor: C.border,
                        }}
                      >
                        <Text
                          style={{
                            color: dp.isPressureHigh ? C.amber : C.sub,
                            fontSize: 12,
                            fontWeight: '600',
                          }}
                        >
                          {dp.statusText}
                        </Text>
                      </View>
                    </Card>
                  );
                })()}

                {/* Action Bar */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: S.m }}>
                  <Btn
                    title="+ Add Task"
                    icon="add"
                    onPress={() => openTask(undefined, selectedProject.id)}
                    style={{ flex: 1 }}
                  />
                  <Btn
                    title="Break Down"
                    variant="ghost"
                    icon="git-branch-outline"
                    onPress={() => openBreakdownModal(selectedProject.name, selectedProject.id)}
                    compact
                  />
                  {selectedProject.status !== 'archived' ? (
                    <Btn
                      title="Archive"
                      variant="ghost"
                      icon="archive-outline"
                      onPress={() => {
                        archiveProject(selectedProject.id);
                        setSelectedProjectId(null);
                      }}
                      compact
                    />
                  ) : (
                    <Btn
                      title="Activate"
                      variant="ghost"
                      icon="refresh-outline"
                      onPress={() => updateProject(selectedProject.id, { status: 'active' })}
                      compact
                    />
                  )}
                </View>

                {/* Incomplete Tasks Section */}
                <SectionHeader
                  title={`Tasks (${projectTasks.incomplete.length})`}
                  icon="checkbox-outline"
                  right="+ Add"
                  onRightPress={() => openTask(undefined, selectedProject.id)}
                />

                <Card>
                  {projectTasks.incomplete.length === 0 ? (
                    <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: C.green, fontSize: 13.5, fontWeight: '700' }}>
                        All project tasks completed! 🎉
                      </Text>
                    </View>
                  ) : (
                    projectTasks.incomplete.map((t, i) => (
                      <Pressable
                        key={t.id}
                        onPress={() => openTask(t, selectedProject.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: S.m,
                          paddingVertical: 11,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: C.border,
                        }}
                      >
                        <CheckCircle checked={t.done} onPress={() => toggleTask(t.id)} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={2}>
                            {t.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Text style={{ color: C.faint, fontSize: 11.5 }}>{dueLabel(t.dueTs)}</Text>
                            {t.estimatedMinutes ? (
                              <>
                                <Text style={{ color: C.faint, fontSize: 10 }}>•</Text>
                                <Text style={{ color: C.faint, fontSize: 11.5 }}>~{t.estimatedMinutes}m</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                        <PriorityBadge priority={t.priority} />
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            openFocusModal(t.id);
                          }}
                          hitSlop={8}
                          style={{
                            padding: 5,
                            borderRadius: 6,
                            backgroundColor: alpha(C.violet, 0.15),
                          }}
                        >
                          <Ionicons name="flash-outline" size={14} color={C.violet} />
                        </Pressable>
                      </Pressable>
                    ))
                  )}
                </Card>

                {/* Completed Tasks Section */}
                {projectTasks.completed.length > 0 ? (
                  <>
                    <SectionHeader
                      title={`Completed (${projectTasks.completed.length})`}
                      icon="checkmark-done-outline"
                    />
                    <Card>
                      {projectTasks.completed.map((t, i) => (
                        <Pressable
                          key={t.id}
                          onPress={() => openTask(t, selectedProject.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: S.m,
                            paddingVertical: 10,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: C.border,
                          }}
                        >
                          <CheckCircle checked={t.done} onPress={() => toggleTask(t.id)} />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: C.faint,
                                fontSize: 14,
                                textDecorationLine: 'line-through',
                              }}
                              numberOfLines={1}
                            >
                              {t.title}
                            </Text>
                          </View>
                          <Ionicons name="create-outline" size={16} color={C.faint} />
                        </Pressable>
                      ))}
                    </Card>
                  </>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
