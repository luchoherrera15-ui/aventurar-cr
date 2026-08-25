Imports System.Collections.Concurrent

Namespace Services

    Public Class InMemoryConversationStore
        Implements IConversationStore

        Private ReadOnly _historiales As ConcurrentDictionary(Of String, List(Of MensajeConversacion))

        Public Sub New()
            _historiales = New ConcurrentDictionary(Of String, List(Of MensajeConversacion))()
        End Sub

        Public Function ObtenerHistorialAsync(numeroTelefono As String) As Task(Of List(Of MensajeConversacion)) Implements IConversationStore.ObtenerHistorialAsync
            Dim lista = _historiales.GetOrAdd(numeroTelefono, Function(clave) New List(Of MensajeConversacion)())

            SyncLock lista
                Return Task.FromResult(lista.ToList())
            End SyncLock
        End Function

        Public Function AgregarMensajeAsync(numeroTelefono As String, mensaje As MensajeConversacion) As Task Implements IConversationStore.AgregarMensajeAsync
            Dim lista = _historiales.GetOrAdd(numeroTelefono, Function(clave) New List(Of MensajeConversacion)())

            SyncLock lista
                lista.Add(mensaje)
            End SyncLock

            Return Task.CompletedTask
        End Function

        Public Function LimpiarHistorialAsync(numeroTelefono As String) As Task Implements IConversationStore.LimpiarHistorialAsync
            Dim historialDescartado As List(Of MensajeConversacion) = Nothing
            _historiales.TryRemove(numeroTelefono, historialDescartado)

            Return Task.CompletedTask
        End Function

    End Class

End Namespace
